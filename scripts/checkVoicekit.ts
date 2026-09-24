/// <reference types="node" />
// Загружаем .env при локальном запуске; не перезаписывает переменные хостинга
import 'dotenv/config'

/**
 * scripts/checkVoicekit.ts
 *
 * Smoke-тест интеграции с T-Bank VoiceKit STT.
 * Не зависит от LLM, SQLite или RAG.
 *
 * Что проверяет:
 *   1. Скачивает первый звонок через Calls API (уже проверенный клиент)
 *   2. Передаёт аудио в VoiceKit gRPC Recognize
 *   3. Выводит транскрипт
 *   Аудио не сохраняется на диск.
 *
 * Требует в .env:
 *   CALLS_API_BASE_URL, CALLS_API_TOKEN
 *   VOICEKIT_API_KEY, VOICEKIT_SECRET_KEY
 *
 * Запуск: npm run check-stt
 */

import { fetchCalls, downloadAudio } from '../server/utils/callsApi'
import { transcribeAudio } from '../server/utils/voicekit'

async function main(): Promise<void> {
  console.log('🎙 VoiceKit STT — smoke test\n')

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

  // ── 3. STT ─────────────────────────────────────────────────────────────────
  console.log('\n3. Транскрибирование через VoiceKit gRPC...')
  const transcript = await transcribeAudio(audio, call.id)

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
