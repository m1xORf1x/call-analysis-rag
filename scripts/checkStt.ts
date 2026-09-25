/// <reference types="node" />
// Загружаем .env при локальном запуске; не перезаписывает переменные хостинга
import 'dotenv/config'

/**
 * scripts/checkStt.ts
 *
 * Smoke-тест активного STT-провайдера (см. server/utils/sttProvider.ts).
 * Провайдер выбирается через env STT_PROVIDER: "soniox" (по умолчанию) | "voicekit".
 * Не зависит от LLM, SQLite или RAG.
 *
 * Что проверяет:
 *   1. Скачивает первый звонок через Calls API (уже проверенный клиент)
 *   2. Передаёт аудио активному STT-провайдеру
 *   3. Выводит транскрипт
 *   Аудио не сохраняется на диск.
 *
 * Требует в .env:
 *   CALLS_API_BASE_URL, CALLS_API_TOKEN
 *   + переменные активного провайдера:
 *     Soniox:   SONIOX_API_KEY
 *     VoiceKit: VOICEKIT_API_KEY, VOICEKIT_SECRET_KEY
 *
 * Запуск:
 *   npm run check-stt                          # активный провайдер (по умолчанию Soniox)
 *   STT_PROVIDER=voicekit npm run check-stt     # явно проверить VoiceKit
 */

import { fetchCalls, downloadAudio } from '../server/utils/callsApi'
import { getSttProvider } from '../server/utils/sttProvider'

async function main(): Promise<void> {
  const providerName = (process.env.STT_PROVIDER?.trim() || 'soniox').toLowerCase()
  console.log(`🎙 STT smoke test — активный провайдер: ${providerName}\n`)

  // ── 1. Получить список звонков ──────────────────────────────────────────────
  process.stdout.write('1. Получение списка звонков... ')
  const calls = await fetchCalls()
  console.log(`OK (${calls.length} шт.)`)

  if (calls.length === 0) {
    console.warn('   ⚠ Нет звонков — нечего транскрибировать.')
    return
  }

  const call = calls[0]!
  console.log(`   Используем: ${call.id} — ${call.filename} (${call.duration_sec}s)`)

  // ── 2. Скачать аудио ────────────────────────────────────────────────────────
  process.stdout.write(`\n2. Скачивание аудио ${call.id}... `)
  const audio = await downloadAudio(call)
  console.log(`OK — ${audio.byteLength.toLocaleString()} байт`)

  // ── 3. STT через активный провайдер ─────────────────────────────────────────
  console.log(`\n3. Транскрибирование через "${providerName}"...`)
  const provider = getSttProvider()
  const transcript = await provider.transcribe(audio, call.content_type)

  if (!transcript.trim()) {
    console.warn('   ⚠ Транскрипт пустой (возможно, аудио без речи или неверные параметры)')
  } else {
    console.log('\n── Транскрипт ──────────────────────────────────────────')
    console.log(transcript)
    console.log('────────────────────────────────────────────────────────')
  }

  console.log('\n✅ STT smoke test завершён')
}

main().catch(err => {
  console.error('\n✗ Тест провалился:', err instanceof Error ? err.message : err)
  process.exit(1)
})
