/// <reference types="node" />
/**
 * server/utils/soniox.ts
 *
 * Soniox async STT client (REST API).
 * Docs: https://soniox.com/docs/stt/async/async-transcription
 *
 * Поток транскрибации:
 *   1. POST /v1/files              — загрузка аудио (multipart), получаем file_id
 *   2. POST /v1/transcriptions     — создаём задачу { model, file_id }, получаем id
 *   3. GET  /v1/transcriptions/:id — поллинг до status === "completed" | "error"
 *   4. GET  /v1/transcriptions/:id/transcript — получаем финальный текст/токены
 *   5. DELETE transcription + DELETE file — best-effort очистка (не влияет на результат)
 *
 * Правила безопасности:
 *   - SONIOX_API_KEY читается только из env; никогда не попадает в логи или ошибки.
 *   - Аудио не пишется на диск — передаётся в памяти (Uint8Array/Blob).
 */

import type { STTProvider } from './sttProvider'

const SONIOX_BASE_URL = 'https://api.soniox.com'
const SONIOX_MODEL = 'stt-async-v5'
const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 минут — достаточно для звонков разумной длины

// ─── Конфигурация ────────────────────────────────────────────────────────────

interface SonioxConfig {
  /** Ключ никогда не включается в логи и сообщения об ошибках */
  apiKey: string
}

function getConfig(): SonioxConfig {
  const apiKey = process.env.SONIOX_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('SONIOX_API_KEY is not set. Add it to .env or the hosting environment.')
  }
  return { apiKey }
}

// ─── HTTP-хелперы ─────────────────────────────────────────────────────────────

/**
 * Формирует подробное диагностическое сообщение об ошибке fetch без утечки секретов.
 * fetch() оборачивает исходную причину сбоя (TLS/DNS/ECONNREFUSED и т.п.) в err.cause —
 * без него сообщение вида "fetch failed" не даёт понять реальную причину.
 * API key сюда не передаётся и не может попасть в сообщение.
 */
function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err)
  }

  let detail = `${err.name}: ${err.message}`

  const cause = (err as Error & { cause?: unknown }).cause
  if (cause !== undefined) {
    const causeStr = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)
    detail += ` — cause: ${causeStr}`
  }

  return detail
}

// Ретраи только для сетевых сбоев (fetch выбрасывает исключение до получения ответа —
// например UND_ERR_CONNECT_TIMEOUT, EAI_AGAIN). HTTP-ошибки (401/400/500) сюда не попадают:
// fetch() при них не бросает исключение, а возвращает Response с res.ok === false,
// поэтому они не ретраятся и обрабатываются отдельно в readJsonOrThrow().
const MAX_FETCH_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 300 // небольшой exponential backoff: 300ms, 600ms

async function sonioxFetch(apiKey: string, path: string, init: RequestInit = {}): Promise<Response> {
  let lastErr: unknown

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      return await fetch(`${SONIOX_BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(init.headers ?? {}),
        },
      })
    } catch (err) {
      lastErr = err
      if (attempt < MAX_FETCH_ATTEMPTS) {
        const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  throw new Error(
    `Soniox: network error at ${path} after ${MAX_FETCH_ATTEMPTS} attempts — ${describeFetchError(lastErr)}`,
  )
}

/** Проверяет res.ok и парсит JSON; в сообщение об ошибке попадает только статус и обрезанный текст ответа (без ключа). */
async function readJsonOrThrow(res: Response, context: string): Promise<unknown> {
  if (!res.ok) {
    let detail = ''
    try {
      detail = await res.text()
    } catch {
      // игнорируем — основной статус уже есть
    }
    throw new Error(
      `Soniox: ${context} failed — HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 300)}` : ''}`,
    )
  }
  try {
    return await res.json()
  } catch {
    throw new Error(`Soniox: ${context} — response is not valid JSON`)
  }
}

// ─── Определение имени файла по content-type (для multipart upload) ─────────

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'audio/mpeg': 'audio.mp3',
  'audio/mp3': 'audio.mp3',
  'audio/wav': 'audio.wav',
  'audio/x-wav': 'audio.wav',
  'audio/wave': 'audio.wav',
  'audio/ogg': 'audio.ogg',
  'audio/flac': 'audio.flac',
  'audio/webm': 'audio.webm',
}

function guessFilename(contentType?: string): string {
  if (!contentType) return 'audio'
  return EXTENSION_BY_CONTENT_TYPE[contentType.toLowerCase()] ?? 'audio'
}

// ─── Шаг 1: загрузка аудио ────────────────────────────────────────────────────

async function uploadAudio(apiKey: string, audio: Uint8Array, contentType?: string): Promise<string> {
  const form = new FormData()
  const blob = new Blob([audio], contentType ? { type: contentType } : undefined)
  form.append('file', blob, guessFilename(contentType))

  const res = await sonioxFetch(apiKey, '/v1/files', { method: 'POST', body: form })
  const body = (await readJsonOrThrow(res, 'file upload')) as Record<string, unknown>

  if (typeof body['id'] !== 'string' || !body['id']) {
    throw new Error('Soniox: file upload response missing "id"')
  }
  return body['id']
}

// ─── Шаг 2: создание задачи транскрибации ────────────────────────────────────

async function createTranscription(apiKey: string, fileId: string): Promise<string> {
  const res = await sonioxFetch(apiKey, '/v1/transcriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: SONIOX_MODEL,
      file_id: fileId,
      enable_speaker_diarization: true,
    }),
  })
  const body = (await readJsonOrThrow(res, 'create transcription')) as Record<string, unknown>

  if (typeof body['id'] !== 'string' || !body['id']) {
    throw new Error('Soniox: create transcription response missing "id"')
  }
  return body['id']
}

// ─── Шаг 3: поллинг статуса ───────────────────────────────────────────────────

async function waitUntilCompleted(apiKey: string, transcriptionId: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await sonioxFetch(apiKey, `/v1/transcriptions/${transcriptionId}`)
    const body = (await readJsonOrThrow(res, 'poll transcription status')) as Record<string, unknown>

    if (body['status'] === 'completed') return
    if (body['status'] === 'error') {
      throw new Error(`Soniox: transcription failed — ${body['error_message'] ?? 'unknown error'}`)
    }

    if (Date.now() > deadline) {
      throw new Error(
        `Soniox: transcription timed out after ${POLL_TIMEOUT_MS / 1000}s (last status: ${String(body['status'])})`,
      )
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

// ─── Шаг 4: получение транскрипта ────────────────────────────────────────────

interface SonioxToken {
  text: string
  speaker?: string | number
}

/**
 * Собирает читаемый транскрипт из токенов Soniox.
 * При включённой speaker diarization каждая смена спикера маркируется [Speaker N]
 * — аналогично маркировке [Канал N] в VoiceKit-реализации.
 */
function assembleTranscript(tokens: SonioxToken[]): string {
  const parts: string[] = []
  let currentSpeaker: string | number | undefined

  for (const token of tokens) {
    if (token.speaker !== undefined && token.speaker !== currentSpeaker) {
      currentSpeaker = token.speaker
      parts.push(`\n[Speaker ${currentSpeaker}] `)
    }
    parts.push(token.text)
  }

  return parts.join('').trim()
}

async function fetchTranscript(apiKey: string, transcriptionId: string): Promise<string> {
  const res = await sonioxFetch(apiKey, `/v1/transcriptions/${transcriptionId}/transcript`)
  const body = (await readJsonOrThrow(res, 'fetch transcript')) as Record<string, unknown>

  const tokens = body['tokens']
  if (Array.isArray(tokens) && tokens.length > 0) {
    return assembleTranscript(tokens as SonioxToken[])
  }

  if (typeof body['text'] === 'string') {
    return body['text']
  }

  throw new Error('Soniox: transcript response missing "text"/"tokens"')
}

// ─── Шаг 5: best-effort очистка ──────────────────────────────────────────────

async function cleanup(apiKey: string, transcriptionId: string, fileId: string): Promise<void> {
  try {
    await sonioxFetch(apiKey, `/v1/transcriptions/${transcriptionId}`, { method: 'DELETE' })
  } catch {
    // не влияет на результат транскрибации
  }
  try {
    await sonioxFetch(apiKey, `/v1/files/${fileId}`, { method: 'DELETE' })
  } catch {
    // не влияет на результат транскрибации
  }
}

// ─── Публичный API ────────────────────────────────────────────────────────────

/**
 * Транскрибирует аудио через Soniox async API.
 *
 * @param audio        Аудиоданные в памяти (Uint8Array); на диск не пишется.
 * @param contentType  MIME-тип аудио (опционально; помогает Soniox определить формат).
 * @returns             Транскрипт; при включённой диаризации фразы маркированы [Speaker N].
 */
export async function transcribeAudio(audio: Uint8Array, contentType?: string): Promise<string> {
  const { apiKey } = getConfig()

  const fileId = await uploadAudio(apiKey, audio, contentType)
  const transcriptionId = await createTranscription(apiKey, fileId)

  try {
    await waitUntilCompleted(apiKey, transcriptionId)
    return await fetchTranscript(apiKey, transcriptionId)
  } finally {
    await cleanup(apiKey, transcriptionId, fileId)
  }
}

/** Провайдер Soniox — реализация общего интерфейса STTProvider (основной путь). */
export const sonioxProvider: STTProvider = {
  transcribe: (audio, contentType) => transcribeAudio(audio, contentType),
}
