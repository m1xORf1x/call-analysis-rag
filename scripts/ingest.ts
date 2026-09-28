/// <reference types="node" />
import 'dotenv/config'
/**
 * scripts/ingest.ts
 *
 * Официальный entrypoint полного RAG ingestion pipeline (Часть 2):
 *
 *   documents → parse → chunk → embeddings → Qdrant
 *
 * Порядок шагов важен для надёжности:
 *   1. Парсинг + чанкинг документов (ragChunk) — локально, без сети.
 *   2. Получение embeddings для ВСЕХ chunks (ragEmbed) — если сеть/API
 *      недоступны, Qdrant ещё не тронут.
 *   3. Только ПОСЛЕ успешных 1–2: recreateCollection() — коллекция
 *      полностью пересоздаётся (удаляется и создаётся с нуля), чтобы
 *      исключить stale points от удалённых/изменённых документов.
 *      Простое полное пересоздание — осознанный выбор для этого
 *      тестового проекта; production-миграции (aliases, blue/green)
 *      не реализуются.
 *   4. ensurePayloadIndexes() — keyword-индексы project/source для фильтрации.
 *   5. upsertPoints() — запись всех точек.
 *   6. countPoints() — строгая проверка: count должен быть РОВНО равен
 *      числу chunks (не ">="), иначе pipeline завершается с ошибкой.
 *
 * Идемпотентность: повторный запуск с тем же corpus документов приводит
 * Qdrant collection в состояние, точно соответствующее текущему corpus —
 * без остатков от предыдущих запусков.
 *
 * Поддерживаемые форматы документов: .pdf .docx .pptx .xlsx .md .markdown
 *
 * Запуск: npm run ingest
 */

import { parseAndChunkAll } from '../server/utils/ragChunk'
import { batchEmbedTexts, EMBED_BATCH_SIZE } from '../server/utils/ragEmbed'
import { recreateCollection, ensurePayloadIndexes, upsertPoints, countPoints } from '../server/utils/ragStore'

const DOCS_PATH = process.env.DOCS_PATH?.trim() || './data/docs'

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function step(label: string) {
  console.log(`\n▶ ${label}`)
}

function info(label: string, value: string | number) {
  console.log(`  ${label.padEnd(22)} ${value}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║   RAG Ingest — documents → chunks → embeddings → Qdrant     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  // ── 1. Ingestion + chunking (без сети) ─────────────────────────────────────
  step('Ingestion + chunking...')
  const chunks = await parseAndChunkAll(DOCS_PATH)

  const sources = new Set(chunks.map(c => c.source))
  info('Documents:', sources.size)
  info('Chunks:', chunks.length)

  if (chunks.length === 0) {
    console.error('\n✗ Нет chunks. Проверьте папку', DOCS_PATH)
    process.exit(1)
  }

  // ── 2. Embeddings — ДО любых изменений в Qdrant ─────────────────────────────
  step('Embeddings...')
  const texts = chunks.map(c => c.text)
  const totalBatches = Math.ceil(texts.length / EMBED_BATCH_SIZE)
  info('Batch size:', EMBED_BATCH_SIZE)
  info('Batches total:', totalBatches)

  const embedResult = await batchEmbedTexts(texts, (done, total) => {
    process.stdout.write(`\r  Progress: ${done}/${total} vectors  `)
  })
  process.stdout.write('\n')

  // Верифицируем: число векторов = числу chunks
  if (embedResult.inputCount !== chunks.length) {
    throw new Error(
      `ingest: несовпадение — получено ${embedResult.inputCount} векторов для ${chunks.length} chunks`,
    )
  }

  info('Model:', embedResult.model)
  info('Dimensions:', embedResult.dimensions)
  info('Vectors created:', embedResult.inputCount)

  // ─────────────────────────────────────────────────────────────────────────────
  // Документы, chunks и embeddings проверены. Только теперь можно менять Qdrant —
  // ошибка на более раннем шаге не уничтожает рабочий индекс раньше времени.
  // ─────────────────────────────────────────────────────────────────────────────

  // ── 3. Qdrant — полное пересоздание коллекции ───────────────────────────────
  step('Recreating Qdrant collection (clean slate)...')
  await recreateCollection(embedResult.dimensions)
  info('Collection:', process.env.QDRANT_COLLECTION ?? '?')
  info('Status:', 'recreated — no stale points possible')

  // ── 3b. Payload indexes ─────────────────────────────────────────────────────
  await ensurePayloadIndexes()
  info('Payload indexes:', 'project, source — OK')

  // ── 4. Qdrant — upsert ──────────────────────────────────────────────────────
  step('Upsert points...')
  const { pointsUpserted, collectionName } = await upsertPoints(chunks, embedResult.vectors)
  info('Points upserted:', pointsUpserted)

  // ── 5. Строгая верификация: count === chunks.length (не >=) ─────────────────
  step('Verification...')
  const count = await countPoints()
  info('Points in Qdrant:', count)

  if (count !== chunks.length) {
    throw new Error(
      `ingest: несоответствие после ingest — Qdrant содержит ${count} points, ` +
      `ожидалось ровно ${chunks.length} (= число chunks). ` +
      `Проверьте upsert/recreateCollection.`,
    )
  }

  // ── Итог ────────────────────────────────────────────────────────────────────
  console.log()
  console.log('══════════════════════════════════════════════════════════════')
  console.log('  ИТОГ')
  console.log('══════════════════════════════════════════════════════════════')
  info('Documents:', sources.size)
  info('Chunks:', chunks.length)
  info('Embeddings created:', embedResult.inputCount)
  info('Dimensions:', embedResult.dimensions)
  info('Points upserted:', pointsUpserted)
  info('Points in Qdrant:', count)
  info('Collection:', collectionName)
  console.log()
  console.log('  ✓ Готово — Qdrant точно соответствует текущему corpus (count === chunks)')
}

main().catch(err => {
  console.error('\n✗ Ошибка:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
