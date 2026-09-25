/// <reference types="node" />
/**
 * server/utils/voicekit.ts
 *
 * T-Bank VoiceKit STT client.
 * API: https://ai.tbank.ru / gRPC api.tinkoff.ai:443
 *
 * Статус: резервная/legacy реализация STTProvider. Основной провайдер — Soniox
 * (см. server/utils/soniox.ts, server/utils/sttProvider.ts).
 *
 * Авторизация: JWT HS256
 *   - kid  = VOICEKIT_API_KEY
 *   - aud  = "tinkoff.cloud.stt"
 *   - secret: base64-decoded VOICEKIT_SECRET_KEY (официальная схема T-Bank)
 *
 * Метод: SpeechToText.Recognize (unary, до 32 МБ)
 * Аудио: MPEG_AUDIO, 8000 Гц, 2 канала (параметры согласованы с заказчиком)
 *
 * Правила безопасности:
 *   - Ключи и секрет читаются только из env; в логи/ошибки не попадают.
 *   - JWT логируется только длиной (для отладки), но не телом.
 */

import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { createHmac, randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { STTProvider } from './sttProvider'

// ─── Пути ─────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// protos/ лежит в корне проекта: server/utils/ → ../../protos
const PROTOS_DIR = join(__dirname, '..', '..', 'protos')
const VOICEKIT_ENDPOINT = 'api.tinkoff.ai:443'

// ─── TypeScript-интерфейсы для динамического gRPC ─────────────────────────────

interface Duration {
  seconds?: string | number
  nanos?: number
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResult {
  alternatives: SpeechRecognitionAlternative[]
  channel: number
  startTime?: Duration
  endTime?: Duration
}

interface RecognizeResponse {
  results: SpeechRecognitionResult[]
}

interface SttClient extends grpc.Client {
  Recognize(
    request: object,
    callback: (err: grpc.ServiceError | null, response: RecognizeResponse) => void,
  ): grpc.ClientUnaryCall
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

/** Base64URL-кодирование (RFC 4648 §5). */
function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Генерирует JWT по официальной схеме T-Bank VoiceKit.
 *
 * Заголовок: { alg: "HS256", typ: "JWT", kid: <apiKey> }
 * Payload:   { iss, sub, aud: <scope>, exp: now+600, jti: <uuid> }
 * Подпись:   HMAC-SHA256(header.payload, base64decode(secretKey))
 *
 * Важно: secretKey хранится в формате base64 и декодируется перед использованием.
 * Источник схемы: voicekit-examples/nodejs/auth.js
 *
 * JWT в логи не выводится; функция не принимает секрет как параметр лога.
 */
function generateJwt(apiKey: string, secretKey: string, audience: string): string {
  const header = { alg: 'HS256', typ: 'JWT', kid: apiKey }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: 'bestseller-ai',
    sub: 'bestseller-ai',
    aud: audience,
    exp: now + 600, // 10 минут — достаточно для одного запроса
    jti: randomUUID(), // уникальный идентификатор токена
  }

  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`

  // Секрет декодируется из base64 — официальная схема T-Bank
  const secret = Buffer.from(secretKey, 'base64')
  const signature = base64url(createHmac('sha256', secret).update(data, 'utf-8').digest())

  return `${data}.${signature}`
}

// ─── gRPC клиент ──────────────────────────────────────────────────────────────

/**
 * Загружает proto-определения и создаёт gRPC-клиент SpeechToText.
 * TLS + JWT-авторизация через MetadataGenerator.
 */
function createSttClient(apiKey: string, secretKey: string): SttClient {
  const packageDefinition = protoLoader.loadSync('tinkoff/cloud/stt/v1/stt.proto', {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [PROTOS_DIR],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechToText = (grpc.loadPackageDefinition(packageDefinition) as any)
    .tinkoff.cloud.stt.v1.SpeechToText as grpc.ServiceClientConstructor

  const channelCreds = grpc.credentials.createSsl()
  const callCreds = grpc.credentials.createFromMetadataGenerator((_params, callback) => {
    const jwt = generateJwt(apiKey, secretKey, 'tinkoff.cloud.stt')
    const meta = new grpc.Metadata()
    meta.set('authorization', `Bearer ${jwt}`)
    callback(null, meta)
  })
  const combined = grpc.credentials.combineChannelCredentials(channelCreds, callCreds)

  return new SpeechToText(VOICEKIT_ENDPOINT, combined) as unknown as SttClient
}

// ─── Сборка транскрипта ────────────────────────────────────────────────────────

/**
 * Собирает транскрипт из результатов Recognize.
 *
 * Для двухканального аудио каждая фраза маркируется [Канал N].
 * Результаты сортируются по времени начала фразы, затем по номеру канала.
 * Берётся первая (наиболее вероятная) альтернатива.
 */
function assembleTranscript(results: SpeechRecognitionResult[]): string {
  if (results.length === 0) return ''

  const hasMultiChannel = results.some(r => r.channel !== 0)

  const sorted = [...results].sort((a, b) => {
    const aS = Number(a.startTime?.seconds ?? 0)
    const bS = Number(b.startTime?.seconds ?? 0)
    if (aS !== bS) return aS - bS
    const aN = a.startTime?.nanos ?? 0
    const bN = b.startTime?.nanos ?? 0
    if (aN !== bN) return aN - bN
    return (a.channel ?? 0) - (b.channel ?? 0)
  })

  const lines: string[] = []
  for (const result of sorted) {
    const text = result.alternatives[0]?.transcript?.trim()
    if (!text) continue
    lines.push(hasMultiChannel ? `[Канал ${result.channel}] ${text}` : text)
  }

  return lines.join('\n')
}

// ─── Публичный API ────────────────────────────────────────────────────────────

/**
 * Транскрибирует аудио через T-Bank VoiceKit gRPC Recognize.
 *
 * @param audio   Аудиоданные в памяти (Uint8Array); на диск не пишется.
 * @param callId  ID звонка — только для сообщений об ошибках; секреты не включаются.
 * @returns       Транскрипт: для 2-канального аудио фразы маркированы [Канал N].
 */
export async function transcribeAudio(audio: Uint8Array, callId: string): Promise<string> {
  const apiKey = process.env.VOICEKIT_API_KEY?.trim()
  const secretKey = process.env.VOICEKIT_SECRET_KEY?.trim()

  if (!apiKey) {
    throw new Error('VOICEKIT_API_KEY is not set. Add it to .env or the hosting environment.')
  }
  if (!secretKey) {
    throw new Error('VOICEKIT_SECRET_KEY is not set. Add it to .env or the hosting environment.')
  }

  const client = createSttClient(apiKey, secretKey)

  try {
    const response = await new Promise<RecognizeResponse>((resolve, reject) => {
      client.Recognize(
        {
          config: {
            encoding: 'MPEG_AUDIO',
            sampleRateHertz: 8000,
            numChannels: 2,
            enableAutomaticPunctuation: true,
          },
          audio: {
            // gRPC proto-loader expects Buffer for bytes fields
            content: Buffer.from(audio),
          },
        },
        (err, response) => {
          if (err) {
            // Формируем понятную ошибку без секретов
            const grpcCode = err.code !== undefined ? ` (gRPC ${err.code})` : ''
            reject(
              new Error(`Call ${callId}: VoiceKit recognition failed${grpcCode} — ${err.message}`),
            )
          } else {
            resolve(response)
          }
        },
      )
    })

    if (!response.results || response.results.length === 0) {
      throw new Error(`Call ${callId}: VoiceKit returned empty recognition results`)
    }

    return assembleTranscript(response.results)
  } finally {
    // Закрываем gRPC-канал после каждого вызова
    client.close()
  }
}

/**
 * VoiceKit как реализация общего интерфейса STTProvider.
 * callId в интерфейсе STTProvider не передаётся — используется placeholder
 * для сообщений об ошибках (без потери контекста ключей/секретов).
 */
export const voicekitProvider: STTProvider = {
  transcribe: (audio, _contentType) => transcribeAudio(audio, 'voicekit'),
}
