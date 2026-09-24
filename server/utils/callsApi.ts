/// <reference types="node" />
/**
 * server/utils/callsApi.ts
 *
 * Клиент внешнего Calls API.
 * Используется из scripts/pipeline.ts и (позже) из Nitro API-эндпоинтов.
 *
 * Контракт API:
 *   GET /v1/health          → { ok: true }
 *   GET /v1/calls           → { calls: Call[] }         Authorization: Bearer {token}
 *   GET /v1/calls/{id}/audio → тело файла или 302       Authorization: Bearer {token}
 *
 * Правила безопасности:
 *   - Токен читается только из env-переменной; никогда не попадает в логи/ошибки.
 *   - Аудио в памяти (Uint8Array), на диск не пишется.
 */

import type { Call } from '../../types/index.ts'

// ─── Конфигурация ──────────────────────────────────────────────────────────

interface CallsApiConfig {
  baseUrl: string
  /** Токен никогда не включается в сообщения об ошибках и логи */
  token: string
}

/**
 * Читает только CALLS_API_BASE_URL.
 * Используется в checkHealth(), которому токен не нужен.
 */
function getBaseUrl(): string {
  const baseUrl = process.env.CALLS_API_BASE_URL?.trim().replace(/\/+$/, '')
  if (!baseUrl) {
    throw new Error(
      'CALLS_API_BASE_URL is not set. Add it to .env or the hosting environment.',
    )
  }
  return baseUrl
}

/**
 * Читает и валидирует обе env-переменные.
 * Вызывается лениво при каждом запросе, чтобы поддерживать подмену в тестах.
 */
function getConfig(): CallsApiConfig {
  const baseUrl = getBaseUrl()
  const token = process.env.CALLS_API_TOKEN?.trim()

  if (!token) {
    throw new Error(
      'CALLS_API_TOKEN is not set. Add it to .env or the hosting environment.',
    )
  }

  return { baseUrl, token }
}

// ─── Health check ──────────────────────────────────────────────────────────

/**
 * Проверяет доступность Calls API.
 * Требует только CALLS_API_BASE_URL; токен не нужен.
 * Возвращает false при любой сетевой или статус-ошибке.
 */
export async function checkHealth(): Promise<boolean> {
  const baseUrl = getBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/v1/health`)
    if (!res.ok) return false
    const body = (await res.json()) as unknown
    return (
      typeof body === 'object' &&
      body !== null &&
      (body as Record<string, unknown>).ok === true
    )
  } catch {
    return false
  }
}

// ─── fetchCalls ────────────────────────────────────────────────────────────

/**
 * GET /v1/calls — возвращает валидированный массив Call.
 * Выбрасывает ошибку при сетевой проблеме, не-2xx ответе или неверной структуре.
 * Токен в ошибки не включается.
 */
export async function fetchCalls(): Promise<Call[]> {
  const { baseUrl, token } = getConfig()

  let res: Response
  try {
    res = await fetch(`${baseUrl}/v1/calls`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    throw new Error(
      `/v1/calls: network error — ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!res.ok) {
    throw new Error(`/v1/calls: HTTP ${res.status} ${res.statusText}`)
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new Error('/v1/calls: response is not valid JSON')
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as Record<string, unknown>).calls)
  ) {
    throw new Error('/v1/calls: expected response shape { "calls": [...] }')
  }

  const rawCalls = (body as { calls: unknown[] }).calls
  return rawCalls.map((item, i) => validateCallItem(item, i))
}

/** Валидирует один элемент массива calls; выбрасывает понятную ошибку при несоответствии. */
function validateCallItem(item: unknown, index: number): Call {
  if (typeof item !== 'object' || item === null) {
    throw new Error(`/v1/calls: item[${index}] is not an object`)
  }
  const c = item as Record<string, unknown>

  if (typeof c['id'] !== 'string' || !c['id']) {
    throw new Error(`/v1/calls: item[${index}] missing required string field "id"`)
  }
  if (typeof c['filename'] !== 'string') {
    throw new Error(`/v1/calls: call "${c['id']}" missing required string field "filename"`)
  }
  if (typeof c['duration_sec'] !== 'number') {
    throw new Error(`/v1/calls: call "${c['id']}" missing required number field "duration_sec"`)
  }
  if (typeof c['content_type'] !== 'string') {
    throw new Error(`/v1/calls: call "${c['id']}" missing required string field "content_type"`)
  }

  return {
    id: c['id'],
    filename: c['filename'],
    duration_sec: c['duration_sec'],
    content_type: c['content_type'],
  }
}

// ─── downloadAudio ─────────────────────────────────────────────────────────

/**
 * GET /v1/calls/{id}/audio → Uint8Array
 *
 * Redirect обрабатывается автоматически (redirect: 'follow').
 * Node fetch (undici) снимает Authorization при переходе на другой хост —
 * это безопасно для пресайнед-ссылок (S3 и аналогов).
 *
 * Аудио не сохраняется на диск; возвращается в памяти.
 *
 * @throws ошибку с call.id и HTTP-статусом; токен в сообщение не включается.
 */
export async function downloadAudio(call: Call): Promise<Uint8Array> {
  const { baseUrl, token } = getConfig()
  const url = `${baseUrl}/v1/calls/${encodeURIComponent(call.id)}/audio`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'follow', // 200 body и 302 → file оба работают прозрачно
    })
  } catch (err) {
    throw new Error(
      `Call ${call.id}: network error while downloading audio — ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!res.ok) {
    throw new Error(
      `Call ${call.id}: audio download failed — HTTP ${res.status} ${res.statusText}`,
    )
  }

  let buffer: ArrayBuffer
  try {
    buffer = await res.arrayBuffer()
  } catch (err) {
    throw new Error(
      `Call ${call.id}: failed to read audio response body — ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (buffer.byteLength === 0) {
    throw new Error(`Call ${call.id}: received empty audio (0 bytes)`)
  }

  return new Uint8Array(buffer)
}
