/// <reference types="node" />
// Загружаем .env при локальном запуске; не перезаписывает переменные хостинга
import 'dotenv/config'

/**
 * scripts/pipeline.ts
 *
 * Часть 1: Пайплайн обработки звонков
 *
 * Реализованные шаги:
 *   1. fetchCalls    ✅ — GET /v1/calls с валидацией ответа
 *   2. downloadAudio ✅ — GET /v1/calls/{id}/audio, redirect, Uint8Array
 *   3. transcribe    ✅ — STT через активный провайдер (STT_PROVIDER; по умолчанию Soniox,
 *                          см. server/utils/sttProvider.ts)
 *   4. analyse       ✅ — BotHub LLM (server/utils/bothub.ts)
 *   5. SQLite        ✅ — persistence + защита от повторной обработки (server/utils/db.ts)
 *
 * Кэш / возобновление после частичного успеха (по call_id в SQLite):
 *   - analysis_json уже есть  → звонок полностью пропускается (ни STT, ни LLM не вызываются);
 *   - transcript уже есть, analysis_json нет → STT пропускается, вызывается только LLM
 *     (типичный случай: STT прошёл, LLM упал на предыдущем запуске);
 *   - ни того, ни другого нет → полный проход: скачать → STT → LLM.
 * Успешное завершение шага очищает error (error = NULL); "failed" сохраняет актуальную ошибку.
 * Устойчивость: ошибка одного звонка не останавливает обработку остальных
 *               (сохраняется как status "failed" + error, пайплайн идёт дальше).
 *
 * Запуск полного пайплайна: npm run pipeline
 * Быстрая проверка только API:  npm run check-api
 */

import { fetchCalls, downloadAudio } from '../server/utils/callsApi'
import { getSttProvider } from '../server/utils/sttProvider'
import { analyseTranscript } from '../server/utils/bothub'
import { getCall, createCall, updateCallStatus } from '../server/utils/db'

// ─── Шаг 3: Транскрибировать аудио (реализовано) ───────────────────────────

async function transcribe(audio: Uint8Array, callId: string, contentType: string): Promise<string> {
  const provider = getSttProvider()
  try {
    return await provider.transcribe(audio, contentType)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Call ${callId}: STT failed — ${msg}`)
  }
}

// ─── Шаг 4: Анализ транскрипта через LLM (реализовано) ─────────────────────

async function analyse(transcript: string, callId: string) {
  try {
    return await analyseTranscript(transcript)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Call ${callId}: LLM analysis failed — ${msg}`)
  }
}

// ─── Главная функция ────────────────────────────────────────────────────────

async function runPipeline(): Promise<void> {
  console.log('▶ Запуск пайплайна звонков...\n')

  // Шаг 1: получить список (реализовано)
  const calls = await fetchCalls()
  console.log(`  Найдено звонков: ${calls.length}`)

  if (calls.length === 0) {
    console.log('  Нет звонков для обработки.')
    return
  }

  // Шаги 2–4: обработать каждый звонок независимо; результат — в SQLite
  for (const call of calls) {
    console.log(`\n── Звонок ${call.id} (${call.filename}, ${call.duration_sec}s) ──`)

    // Шаг 0: проверка по SQLite — пропустить полностью обработанные, возобновить частично обработанные
    const existing = getCall(call.id)
    if (existing?.analysis_json) {
      console.log('  ⏭ Уже проанализирован (analysis сохранён), пропуск')
      continue
    }

    // Создаёт запись со статусом "pending", если её ещё нет (идемпотентно)
    createCall(call.id)

    try {
      let transcript: string

      if (existing?.transcript) {
        // Транскрипт уже сохранён с предыдущего запуска (например, LLM упал после успешного STT) —
        // не скачиваем аудио и не вызываем STT повторно.
        console.log('  ⏭ Транскрипт уже есть, пропуск скачивания и STT')
        transcript = existing.transcript
      } else {
        // Шаг 2: скачать аудио (реализовано)
        console.log('  ↓ Скачивание аудио...')
        const audio = await downloadAudio(call)
        console.log(`    ${audio.byteLength} байт`)

        // Шаг 3: транскрибировать (реализовано)
        console.log('  🎙 Транскрибирование...')
        transcript = await transcribe(audio, call.id, call.content_type)
        // error очищается (null) — предыдущая ошибка (если была) больше не актуальна
        updateCallStatus(call.id, { status: 'transcribed', transcript, error: null })
        console.log('    OK')
      }

      // Шаг 4: LLM-анализ (реализовано)
      console.log('  🤖 Анализ...')
      const analysis = await analyse(transcript, call.id)
      updateCallStatus(call.id, {
        status: 'completed',
        analysisJson: JSON.stringify(analysis),
        error: null, // успешное завершение очищает старую ошибку
      })

      console.log(`  ✓ Готово`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      updateCallStatus(call.id, { status: 'failed', error: message })
      console.error(`  ✗ ${message}`)
    }
  }

  console.log('\n✓ Пайплайн завершён')
}

runPipeline().catch(err => {
  console.error('✗ Критическая ошибка пайплайна:', err instanceof Error ? err.message : err)
  process.exit(1)
})
