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
 *   3. transcribe    ✅ — T-Bank VoiceKit gRPC Recognize
 *
 * Заглушки (ждут ключей и следующих этапов):
 *   (STT реализован)
 *   4. analyse       🔲 — LLM
 *   5. saveResult    🔲 — SQLite persistence
 *
 * Кэш: isAlreadyProcessed() — заглушка, всегда false до реализации хранилища.
 * Устойчивость: ошибка одного звонка не останавливает обработку остальных.
 *
 * Запуск полного пайплайна: npm run pipeline
 * Быстрая проверка только API:  npm run check-api
 */

import type { CallRecord, CallAnalysis } from '../types/index.ts'
import { fetchCalls, downloadAudio } from '../server/utils/callsApi'
import { transcribeAudio } from '../server/utils/voicekit'

// ─── Шаг 3: Транскрибировать аудио (реализовано) ───────────────────────────

async function transcribe(audio: Uint8Array, callId: string): Promise<string> {
  return transcribeAudio(audio, callId)
}

// ─── Шаг 4: Анализ транскрипта через LLM ───────────────────────────────────

async function analyse(_transcript: string, callId: string): Promise<CallAnalysis> {
  // TODO: реализовать через LLM (LLM_API_KEY, LLM_MODEL)
  // Роль: аналитик звонков отдела продаж недвижимости
  // Ответ — только валидный JSON по схеме CallAnalysis, без Markdown
  throw new Error(`analyse(${callId}): не реализовано — ожидает LLM-ключ`)
}

// ─── Шаг 5: Сохранить результат ────────────────────────────────────────────

async function saveResult(record: CallRecord): Promise<void> {
  // TODO: реализовать запись в SQLite
  // Поля: id, filename, duration_sec, status, transcript, analysis, error, created_at, updated_at
  throw new Error(`saveResult(${record.id}): не реализовано — ожидает SQLite`)
}

// ─── Кэш: проверить, обработан ли уже этот звонок ──────────────────────────

async function isAlreadyProcessed(_callId: string): Promise<boolean> {
  // TODO: запрос к SQLite — вернуть true, если status === 'analyzed'
  return false
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

  // Шаги 2–5: обработать каждый звонок независимо
  for (const call of calls) {
    console.log(`\n── Звонок ${call.id} (${call.filename}, ${call.duration_sec}s) ──`)

    if (await isAlreadyProcessed(call.id)) {
      console.log('  ⏭ Уже обработан, пропуск')
      continue
    }

    const now = new Date().toISOString()
    const record: CallRecord = {
      ...call,
      status: 'pending',
      transcript: null,
      analysis: null,
      error: null,
      created_at: now,
      updated_at: now,
    }

    try {
      // Шаг 2: скачать аудио (реализовано)
      console.log('  ↓ Скачивание аудио...')
      const audio = await downloadAudio(call)
      record.status = 'downloaded'
      console.log(`    ${audio.byteLength} байт`)

      // Шаг 3: транскрибировать (заглушка)
      console.log('  🎙 Транскрибирование...')
      record.transcript = await transcribe(audio, call.id)
      record.status = 'transcribed'

      // Шаг 4: LLM-анализ (заглушка)
      console.log('  🤖 Анализ...')
      record.analysis = await analyse(record.transcript, call.id)
      record.status = 'analyzed'

      console.log(`  ✓ Готово`)
    } catch (err) {
      record.status = 'error'
      record.error = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${record.error}`)
    } finally {
      record.updated_at = new Date().toISOString()
    }

    // Шаг 5: сохранить (заглушка)
    try {
      await saveResult(record)
    } catch (saveErr) {
      // Не прерываем пайплайн — SQLite пока не реализован
      const msg = saveErr instanceof Error ? saveErr.message : String(saveErr)
      console.log(`  (хранилище): ${msg}`)
    }
  }

  console.log('\n✓ Пайплайн завершён')
}

runPipeline().catch(err => {
  console.error('✗ Критическая ошибка пайплайна:', err instanceof Error ? err.message : err)
  process.exit(1)
})
