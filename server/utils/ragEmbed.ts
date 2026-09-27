/**
 * server/utils/ragEmbed.ts
 *
 * Часть 2 RAG — Этап 3: embedding client.
 * OpenAI-compatible POST /v1/embeddings.
 *
 * Правила безопасности:
 *   - EMBEDDINGS_API_KEY читается только из env; никогда не попадает в логи.
 *   - EMBEDDINGS_MODEL читается только из env; без значений по умолчанию.
 *
 * Используется тот же base URL, что и BotHub (https://openai.bothub.chat/v1),
 * если не задан EMBEDDINGS_BASE_URL.
 * Не зависит от Part 1 и не изменяет его.
 */

// ─── Конфигурация ────────────────────────────────────────────────────────────

const DEFAULT_EMBEDDINGS_BASE_URL = 'https://openai.bothub.chat/v1'

interface EmbedConfig {
  /** Никогда не включается в логи и ошибки */
  apiKey: string
  model: string
  baseUrl: string
}

function getConfig(): EmbedConfig {
  const apiKey = process.env.EMBEDDINGS_API_KEY?.trim()
  if (!apiKey) throw new Error('EMBEDDINGS_API_KEY is not set. Add it to .env or the hosting environment.')

  const model = process.env.EMBEDDINGS_MODEL?.trim()
  if (!model) throw new Error('EMBEDDINGS_MODEL is not set. Add it to .env or the hosting environment.')

  const baseUrl = (process.env.EMBEDDINGS_BASE_URL?.trim() || DEFAULT_EMBEDDINGS_BASE_URL).replace(/\/$/, '')

  return { apiKey, model, baseUrl }
}

// ─── OpenAI-compatible response types ────────────────────────────────────────

interface EmbeddingObject {
  object: 'embedding'
  index: number
  embedding: number[]
}

interface EmbeddingsResponse {
  object: string
  data: EmbeddingObject[]
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

// ─── Публичный API ────────────────────────────────────────────────────────────

export interface EmbedResult {
  /** Имя модели из ответа API (может отличаться от запрошенной) */
  model: string
  /** Матрица векторов: один вектор на входной текст */
  vectors: number[][]
  /** Число входных элементов */
  inputCount: number
  /** Размерность каждого вектора (берётся из реального ответа) */
  dimensions: number
}

/** Число текстов в одном HTTP-запросе к /v1/embeddings */
export const EMBED_BATCH_SIZE = 100

/**
 * Отправляет тексты батчами по EMBED_BATCH_SIZE и возвращает сводный результат.
 * Проверяет одинаковую размерность векторов во всех батчах.
 *
 * @param texts  Массив строк (не пустой).
 * @param onBatch  Опциональный callback прогресса: (done, total) => void
 */
export async function batchEmbedTexts(
  texts: string[],
  onBatch?: (done: number, total: number) => void,
): Promise<EmbedResult> {
  if (texts.length === 0) throw new Error('ragEmbed: batchEmbedTexts — пустой массив')

  const allVectors: number[][] = []
  let resolvedModel = ''
  let resolvedDimensions = 0

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE)
    const result = await embedTexts(batch)

    if (resolvedDimensions === 0) {
      resolvedDimensions = result.dimensions
      resolvedModel = result.model
    } else if (result.dimensions !== resolvedDimensions) {
      throw new Error(
        `ragEmbed: размерность векторов изменилась между батчами (${resolvedDimensions} → ${result.dimensions})`,
      )
    }

    allVectors.push(...result.vectors)
    onBatch?.(allVectors.length, texts.length)
  }

  return {
    model: resolvedModel,
    vectors: allVectors,
    inputCount: allVectors.length,
    dimensions: resolvedDimensions,
  }
}

/**
 * Отправляет массив строк в /v1/embeddings и возвращает матрицу векторов.
 *
 * @param texts   Массив строк для эмбеддинга (не должен быть пустым).
 * @throws        Описательная ошибка при сетевых проблемах или HTTP != 200.
 *                API key никогда не включается в сообщение об ошибке.
 */
export async function embedTexts(texts: string[]): Promise<EmbedResult> {
  if (texts.length === 0) throw new Error('ragEmbed: передан пустой массив текстов')

  const { apiKey, model, baseUrl } = getConfig()

  // ── Запрос ──────────────────────────────────────────────────────────────────
  let res: Response
  try {
    res = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: texts }),
    })
  } catch (err) {
    throw new Error(
      `ragEmbed: сетевая ошибка — ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // ── HTTP-ошибка ─────────────────────────────────────────────────────────────
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json() as Record<string, unknown>
      // Безопасно извлекаем сообщение без утечки ключа
      const err = body['error'] as Record<string, unknown> | undefined
      detail = typeof err?.['message'] === 'string' ? ` — ${err['message']}` : ''
    } catch { /* тело не JSON */ }
    throw new Error(`ragEmbed: HTTP ${res.status} ${res.statusText}${detail}`)
  }

  // ── Парсинг тела ────────────────────────────────────────────────────────────
  let body: EmbeddingsResponse
  try {
    body = await res.json() as EmbeddingsResponse
  } catch {
    throw new Error('ragEmbed: тело ответа не является валидным JSON')
  }

  if (!Array.isArray(body.data) || body.data.length === 0) {
    throw new Error('ragEmbed: неожиданная структура ответа (нет поля data[])')
  }

  // Сортируем по index для гарантии правильного порядка
  const sorted = [...body.data].sort((a, b) => a.index - b.index)
  const vectors = sorted.map(item => item.embedding)
  const dimensions = vectors[0]?.length ?? 0

  if (dimensions === 0) {
    throw new Error('ragEmbed: получен вектор нулевой размерности')
  }

  return {
    model: body.model ?? model,
    vectors,
    inputCount: vectors.length,
    dimensions,
  }
}
