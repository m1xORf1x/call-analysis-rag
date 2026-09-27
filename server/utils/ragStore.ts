/**
 * server/utils/ragStore.ts
 *
 * Часть 2 RAG — Этап 3: хранение embeddings в Qdrant.
 *
 * Правила безопасности:
 *   - QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION читаются только из env.
 *   - Credentials никогда не попадают в логи или ошибки.
 *
 * Идемпотентность:
 *   - Point ID детерминирован: SHA-256(source + ":" + chunk_index) → UUID-формат.
 *   - Payload metadata по ТЗ: source, chunk_index, text (+ опциональные page/slide/sheet).
 *   - upsert перезаписывает существующий point с тем же ID — дубликатов нет.
 *
 * Stale points (устаревшие chunks удалённых/сокращённых документов):
 *   - Полный ingest вызывает recreateCollection() — коллекция полностью
 *     пересоздаётся, поэтому после upsert в ней остаются РОВНО chunks
 *     текущего corpus, без остатков от предыдущих запусков.
 *   - Для этого тестового проекта простое полное пересоздание достаточно;
 *     production-миграции (aliases, blue/green) не реализуются.
 */

import { createHash } from 'node:crypto'
import { QdrantClient } from '@qdrant/js-client-rest'
import type { DocumentChunk } from '../../types/index'
import { withRetry } from './ragRetry'

// ─── Конфигурация ────────────────────────────────────────────────────────────

interface StoreConfig {
  url: string
  /** Пустая строка для локального Qdrant без авторизации */
  apiKey: string | undefined
  collection: string
}

function getConfig(): StoreConfig {
  const url = process.env.QDRANT_URL?.trim()
  if (!url) throw new Error('QDRANT_URL is not set. Add it to .env.')

  const collection = process.env.QDRANT_COLLECTION?.trim()
  if (!collection) throw new Error('QDRANT_COLLECTION is not set. Add it to .env.')

  // API key опционален: локальный Qdrant может работать без аутентификации
  const apiKey = process.env.QDRANT_API_KEY?.trim() || undefined

  return { url, apiKey, collection }
}

// ─── Qdrant client factory ────────────────────────────────────────────────────

function makeClient(config: StoreConfig): QdrantClient {
  return new QdrantClient({ url: config.url, apiKey: config.apiKey })
}

// ─── Детерминированный Point ID ───────────────────────────────────────────────

/**
 * Генерирует детерминированный UUID из source + chunkIndex.
 * SHA-256 → берём первые 128 бит → форматируем как 8-4-4-4-12 UUID.
 *
 * Одинаковый (source, chunkIndex) → одинаковый ID → upsert обновляет,
 * а не создаёт дубликат.
 */
function deterministicId(source: string, chunkIndex: number): string {
  const hash = createHash('sha256')
    .update(`${source}:${chunkIndex}`, 'utf8')
    .digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-')
}

// ─── Коллекция ────────────────────────────────────────────────────────────────

/**
 * Полностью пересоздаёт коллекцию: удаляет её (если существует) и создаёт
 * с нуля с заданной размерностью и Cosine distance.
 *
 * Используется полным ingest-пайплайном, чтобы после каждого полного запуска
 * коллекция содержала РОВНО chunks текущего corpus — без stale points от
 * удалённых/изменённых документов прошлых запусков.
 *
 * ВАЖНО (порядок вызова): вызывающий код должен вызывать эту функцию только
 * ПОСЛЕ успешного parsing + chunking + embedding всех документов — чтобы
 * ошибка на более раннем шаге не уничтожала рабочий индекс раньше времени.
 *
 * @param dimensions  Фактическая размерность из ответа embedding API.
 */
export async function recreateCollection(dimensions: number): Promise<void> {
  const config = getConfig()
  const client = makeClient(config)

  await client.recreateCollection(config.collection, {
    vectors: { size: dimensions, distance: 'Cosine' },
  })
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

export interface UpsertStats {
  pointsUpserted: number
  collectionName: string
}

/** Максимальный размер батча при upsert в Qdrant */
const UPSERT_BATCH = 256

/**
 * Upserts DocumentChunk[] + их векторы в Qdrant.
 *
 * Требования перед вызовом:
 *   - chunks.length === vectors.length
 *   - Все векторы одинаковой размерности
 *   - recreateCollection() уже вызван
 *
 * @throws Если chunks.length !== vectors.length.
 */
export async function upsertPoints(
  chunks: DocumentChunk[],
  vectors: number[][],
): Promise<UpsertStats> {
  if (chunks.length !== vectors.length) {
    throw new Error(
      `ragStore: chunks (${chunks.length}) и vectors (${vectors.length}) несовпадают по длине`,
    )
  }

  const config = getConfig()
  const client = makeClient(config)
  const { collection } = config

  // Собираем points
  const points = chunks.map((chunk, i) => {
    const payload: Record<string, unknown> = {
      text: chunk.text,
      source: chunk.source,
      project: chunk.project,
      chunk_index: chunk.chunkIndex,
    }
    if (chunk.pageStart  !== undefined) payload['pageStart']  = chunk.pageStart
    if (chunk.pageEnd    !== undefined) payload['pageEnd']    = chunk.pageEnd
    if (chunk.slideStart !== undefined) payload['slideStart'] = chunk.slideStart
    if (chunk.slideEnd   !== undefined) payload['slideEnd']   = chunk.slideEnd
    if (chunk.sheet      !== undefined) payload['sheet']      = chunk.sheet

    return {
      id: deterministicId(chunk.source, chunk.chunkIndex),
      vector: vectors[i]!,
      payload,
    }
  })

  // Upsert батчами (wait: true = ждём подтверждения от Qdrant)
  for (let i = 0; i < points.length; i += UPSERT_BATCH) {
    const batch = points.slice(i, i + UPSERT_BATCH)
    await client.upsert(collection, { wait: true, points: batch })
  }

  return { pointsUpserted: chunks.length, collectionName: collection }
}

// ─── Payload Indexes ──────────────────────────────────────────────────────────

/**
 * Создаёт keyword-индексы для полей, используемых в фильтрах.
 * Обязательно для Qdrant Cloud (strict mode требует индекс перед фильтрацией).
 * Идемпотентно: повторный вызов не ломает существующие индексы.
 *
 * Поля: project, source  (оба — keyword).
 */
export async function ensurePayloadIndexes(): Promise<void> {
  const config = getConfig()
  const client = makeClient(config)

  const fields: Array<{ name: string; schema: 'keyword' }> = [
    { name: 'project', schema: 'keyword' },
    { name: 'source',  schema: 'keyword' },
  ]

  for (const field of fields) {
    try {
      await client.createPayloadIndex(config.collection, {
        field_name:   field.name,
        field_schema: field.schema,
        wait:         true,
      })
    } catch (e: unknown) {
      // Индекс уже существует → игнорируем
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('already exists') && !msg.includes('Conflict')) {
        throw e
      }
    }
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface RawScoredPoint {
  score: number
  payload: Record<string, unknown>
}

/**
 * Выполняет семантический поиск по коллекции.
 *
 * @param queryVector  Вектор запроса (embedding вопроса).
 * @param topK         Число возвращаемых результатов.
 * @param project      Опциональный фильтр по проекту (alisa | bestseller).
 * @returns            Массив scored points с payload, отсортированный по score desc.
 */
export async function searchPoints(
  queryVector: number[],
  topK: number,
  project?: string,
): Promise<RawScoredPoint[]> {
  return withRetry(
    () => searchPointsOnce(queryVector, topK, project),
    { label: 'RAG' },
  )
}

async function searchPointsOnce(
  queryVector: number[],
  topK: number,
  project?: string,
): Promise<RawScoredPoint[]> {
  const config = getConfig()
  const client = makeClient(config)

  const result = await client.query(config.collection, {
    query: queryVector,
    limit: topK,
    with_payload: true,
    ...(project
      ? {
          filter: {
            must: [{ key: 'project', match: { value: project } }],
          },
        }
      : {}),
  })

  return result.points.map(p => ({
    score: p.score,
    payload: (p.payload ?? {}) as Record<string, unknown>,
  }))
}

/**
 * Возвращает количество точек в коллекции — для финальной верификации.
 * Возвращает 0 ТОЛЬКО если коллекция реально не существует (404/"Not found").
 *
 * Важно: любые прочие ошибки (сетевой таймаут, недоступность Qdrant и т.п.)
 * пробрасываются наружу, а не маскируются как "0 points". Иначе строгая
 * проверка count === chunks.length в ingest-пайплайне могла бы ложно
 * зафиксировать "несоответствие" из-за транзиентного сетевого сбоя, а не
 * из-за реальной проблемы с данными.
 */
export async function countPoints(): Promise<number> {
  const config = getConfig()
  const client = makeClient(config)
  try {
    const result = await client.count(config.collection, { exact: true })
    return result.count
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('Not found') || msg.includes('404') || msg.includes("doesn't exist")) {
      return 0
    }
    throw e
  }
}
