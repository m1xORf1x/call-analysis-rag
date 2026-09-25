/// <reference types="node" />
// Загружаем .env при локальном запуске; не перезаписывает переменные хостинга
import 'dotenv/config'

/**
 * scripts/checkE2E.ts
 *
 * End-to-end smoke-тест: Calls API → STT → LLM.
 * Соединяет три существующих рабочих клиента без хранения, SQLite или RAG.
 *
 * Шаги:
 *   1. GET /v1/calls          — список звонков через Calls API
 *   2. GET /v1/calls/:id/audio — скачать аудио первого звонка
 *   3. Soniox STT             — получить транскрипт
 *   4. BotHub LLM             — analyseTranscript() → CallAnalysis
 *
 * Требует в .env:
 *   CALLS_API_BASE_URL, CALLS_API_TOKEN
 *   SONIOX_API_KEY
 *   BOTHUB_API_KEY, BOTHUB_MODEL
 *
 * Запуск: npm run check-e2e
 */

import { fetchCalls, downloadAudio } from '../server/utils/callsApi'
import { getSttProvider } from '../server/utils/sttProvider'
import { analyseTranscript } from '../server/utils/bothub'
import type { CallAnalysis } from '../types/index.ts'

async function main(): Promise<void> {
  console.log('🔗 E2E smoke test: Calls API → STT → LLM\n')

  // ── 1. Получить список звонков ─────────────────────────────────────────────
  process.stdout.write('1. Получение списка звонков... ')
  const calls = await fetchCalls()
  console.log(`OK (${calls.length} шт.)`)

  if (calls.length === 0) {
    console.error('   ✗ Нет звонков — нечего обрабатывать.')
    process.exit(1)
  }

  const call = calls[0]!
  console.log(`   Используем: ${call.id} — ${call.filename} (${call.duration_sec}s, ${call.content_type})`)

  // ── 2. Скачать аудио ───────────────────────────────────────────────────────
  process.stdout.write(`\n2. Скачивание аудио... `)
  const audio = await downloadAudio(call)
  console.log(`OK — ${audio.byteLength.toLocaleString()} байт`)

  // ── 3. STT ─────────────────────────────────────────────────────────────────
  const providerName = (process.env.STT_PROVIDER?.trim() || 'soniox').toLowerCase()
  console.log(`\n3. STT (${providerName})...`)
  const provider = getSttProvider()
  const transcript = await provider.transcribe(audio, call.content_type)

  if (!transcript.trim()) {
    console.error('   ✗ Транскрипт пустой — LLM-анализ невозможен.')
    process.exit(1)
  }

  const lines = transcript.split('\n').filter(l => l.trim()).length
  console.log(`   OK — ${lines} строк транскрипта`)
  console.log('\n── Транскрипт ──────────────────────────────────────────────')
  console.log(transcript)
  console.log('────────────────────────────────────────────────────────────')

  // ── 4. LLM-анализ ──────────────────────────────────────────────────────────
  console.log(`\n4. LLM-анализ (BOTHUB_MODEL: ${process.env.BOTHUB_MODEL ?? '⚠ не задан'})...`)
  const analysis: CallAnalysis = await analyseTranscript(transcript)

  // ── Вывод результата ───────────────────────────────────────────────────────
  console.log('\n── CallAnalysis ─────────────────────────────────────────────')

  console.log('\n📋 Резюме:')
  console.log('   ', analysis.summary)

  console.log('\n✅ Сильные стороны:')
  console.log('   ', analysis.strongPoints)

  console.log('\n⚠️  Слабые стороны:')
  console.log('   ', analysis.weakPoints)

  console.log('\n💡 Рекомендация:')
  console.log('   ', analysis.recommendation)

  const { client } = analysis
  const emoji = client.interest === 'high' ? '🔴' : client.interest === 'medium' ? '🟡' : '🟢'
  console.log(`\n👤 Клиент (интерес: ${emoji} ${client.interest}):`)
  console.log('   Объект:    ', client.object ?? '—')
  console.log('   Бюджет:    ', client.budget ?? '—')

  if (client.objections.length > 0) {
    console.log('   Возражения:')
    for (const o of client.objections) console.log(`     • ${o}`)
  } else {
    console.log('   Возражения: —')
  }

  if (client.competitors.length > 0) {
    console.log('   Конкуренты:')
    for (const c of client.competitors) console.log(`     • ${c}`)
  } else {
    console.log('   Конкуренты: —')
  }

  console.log('\n────────────────────────────────────────────────────────────')
  console.log('\n✅ E2E тест завершён успешно')
}

main().catch(err => {
  console.error('\n✗ E2E тест провалился:', err instanceof Error ? err.message : err)
  process.exit(1)
})
