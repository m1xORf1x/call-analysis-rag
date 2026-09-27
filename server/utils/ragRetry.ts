/**
 * server/utils/ragRetry.ts
 *
 * Минимальный retry для transient network/provider failures в Part 2 RAG.
 * Не меняет контракты, retrieval logic, validation или prompt.
 */

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_DELAYS_MS = [300, 700]

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function extractHttpStatus(err: unknown): number | null {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: unknown }).status
    if (typeof status === 'number') return status
  }

  const msg = errorMessage(err)
  const match = msg.match(/HTTP (\d{3})/)
  return match ? Number.parseInt(match[1]!, 10) : null
}

function isNetworkLikeError(err: unknown): boolean {
  const parts: string[] = [errorMessage(err)]

  if (err instanceof Error && err.cause instanceof Error) {
    parts.push(err.cause.message)
  }

  const combined = parts.join(' ').toLowerCase()
  const patterns = [
    'fetch failed',
    'failed to fetch',
    'econnrefused',
    'etimedout',
    'enotfound',
    'econnreset',
    'eai_again',
    'socket hang up',
    'network',
    'timeout',
    'dns',
    'сетевая ошибка',
  ]

  return patterns.some(pattern => combined.includes(pattern))
}

function isNonRetryableMessage(msg: string): boolean {
  const nonRetryable = [
    'is not set',
    'пустой массив',
    'передан пустой массив',
    'размерность векторов изменилась',
    'неожиданная структура ответа',
    'нулевой размерности',
    'не является валидным JSON',
    'пустой content',
    'нет choices',
    'несовпадают по длине',
    'не удалось получить вектор',
    "doesn't exist",
    'already exists',
  ]

  return nonRetryable.some(fragment => msg.includes(fragment))
}

/** Определяет, можно ли повторить операцию после transient failure. */
export function isRetryableRagError(err: unknown): boolean {
  const msg = errorMessage(err)

  if (isNonRetryableMessage(msg)) return false

  const status = extractHttpStatus(err)
  if (status !== null) {
    if (status === 429) return true
    if (status >= 500) return true
    return false
  }

  return isNetworkLikeError(err)
}

export interface WithRetryOptions {
  label?: string
  maxAttempts?: number
  delaysMs?: number[]
}

/**
 * Выполняет fn с коротким backoff при transient network/provider failures.
 * После последней неудачи пробрасывает исходную ошибку.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: WithRetryOptions,
): Promise<T> {
  const label = options?.label ?? 'RAG'
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const delaysMs = options?.delaysMs ?? DEFAULT_DELAYS_MS

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      if (!isRetryableRagError(err) || attempt === maxAttempts) {
        throw err
      }

      const nextAttempt = attempt + 1
      console.warn(
        `[${label}] transient failure, retry ${nextAttempt}/${maxAttempts}: ${errorMessage(err)}`,
      )

      const delay = delaysMs[attempt - 1] ?? delaysMs[delaysMs.length - 1] ?? 700
      await sleep(delay)
    }
  }

  throw lastError
}
