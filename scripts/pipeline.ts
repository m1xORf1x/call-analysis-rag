/**
 * scripts/pipeline.ts
 *
 * Часть 1: Пайплайн обработки звонков
 *
 * Цепочка шагов (будет реализована после получения ключей и API):
 *   1. fetchCalls      — GET {CALLS_API_BASE_URL}/v1/calls → список звонков
 *   2. downloadAudio   — GET {CALLS_API_BASE_URL}/v1/calls/{id}/audio → файл
 *   3. transcribe      — отправка аудио в STT → сырой транскрипт
 *   4. analyse         — отправка транскрипта в LLM → CallAnalysis JSON
 *   5. saveResult      — запись в хранилище (call_id, transcript, analysis, status)
 *
 * Кэш: повторный запуск по тем же call_id не запускает STT/LLM заново.
 * Устойчивость: ошибка на любом звонке помечает его статусом 'error',
 *               пайплайн продолжает обработку остальных.
 *
 * Запуск: npm run pipeline
 */

import type { Call, CallRecord, CallAnalysis } from '../types/index.ts'

// ─── Шаг 1: Получить список звонков из API ───────────────────────────────────

async function fetchCalls(): Promise<Call[]> {
  // TODO: реализовать после получения CALLS_API_BASE_URL и CALLS_API_TOKEN
  // const baseUrl = process.env.CALLS_API_BASE_URL
  // const token   = process.env.CALLS_API_TOKEN
  // GET {baseUrl}/v1/calls
  // Authorization: Bearer {token}
  throw new Error('fetchCalls: не реализовано')
}

// ─── Шаг 2: Скачать аудиофайл ────────────────────────────────────────────────

async function downloadAudio(call: Call): Promise<Uint8Array> {
  // TODO: реализовать
  // GET {BASE}/v1/calls/{id}/audio
  // Обработать 302 redirect на файл
  // Если 4xx/5xx — бросить ошибку (звонок будет помечен 'error')
  throw new Error(`downloadAudio(${call.id}): не реализовано`)
}

// ─── Шаг 3: Транскрибировать аудио ───────────────────────────────────────────

async function transcribe(audio: Uint8Array, call: Call): Promise<string> {
  // TODO: реализовать через STT-провайдер (ключ из STT_API_KEY)
  // Вернуть сырой текст транскрипта
  throw new Error(`transcribe(${call.id}): не реализовано`)
}

// ─── Шаг 4: Анализ транскрипта через LLM ─────────────────────────────────────

async function analyse(transcript: string, callId: string): Promise<CallAnalysis> {
  // TODO: реализовать через LLM (ключ из LLM_API_KEY, модель из LLM_MODEL)
  // Роль модели: аналитик звонков отдела продаж недвижимости
  // Промпт должен требовать только валидный JSON без Markdown
  // null / [] для пустых полей — допустимо
  throw new Error(`analyse(${callId}): не реализовано`)
}

// ─── Шаг 5: Сохранить результат ──────────────────────────────────────────────

async function saveResult(record: CallRecord): Promise<void> {
  // TODO: реализовать запись в SQLite (или другое выбранное хранилище)
  // Поля: id, filename, duration_sec, status, transcript, analysis, error, created_at, updated_at
  throw new Error(`saveResult(${record.id}): не реализовано`)
}

// ─── Кэш: проверить, обработан ли уже этот звонок ───────────────────────────

async function isAlreadyProcessed(_callId: string): Promise<boolean> {
  // TODO: запрос к хранилищу — вернуть true, если статус === 'analyzed'
  // Кэш по call_id предотвращает повторный запуск STT/LLM
  return false
}

// ─── Главная функция ──────────────────────────────────────────────────────────

async function runPipeline(): Promise<void> {
  console.log('▶ Запуск пайплайна звонков...')

  // Шаг 1: получить список
  // TODO: в реализации добавить process.exit(1) при критической ошибке
  const calls = await fetchCalls()
  console.log(`  Найдено звонков: ${calls.length}`)

  // Шаги 2–5: обработать каждый звонок независимо
  for (const call of calls) {
    console.log(`\n── Звонок ${call.id} (${call.filename}) ──`)

    // Кэш: пропустить уже обработанные
    if (await isAlreadyProcessed(call.id)) {
      console.log('  ⏭ Уже обработан, пропуск')
      continue
    }

    const record: CallRecord = {
      ...call,
      status: 'pending',
      transcript: null,
      analysis: null,
      error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      // Шаг 2: скачать аудио
      console.log('  ↓ Скачивание аудио...')
      const audio = await downloadAudio(call)
      record.status = 'downloaded'

      // Шаг 3: транскрибировать
      console.log('  🎙 Транскрибирование...')
      record.transcript = await transcribe(audio, call)
      record.status = 'transcribed'

      // Шаг 4: LLM-анализ
      console.log('  🤖 Анализ транскрипта...')
      record.analysis = await analyse(record.transcript, call.id)
      record.status = 'analyzed'

      console.log(`  ✓ Готово (статус: ${record.status})`)
    } catch (err) {
      // Ошибка не останавливает пайплайн — помечаем звонок и идём дальше
      record.status = 'error'
      record.error = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ Ошибка: ${record.error}`)
    } finally {
      record.updated_at = new Date().toISOString()
    }

    // Шаг 5: сохранить (включая ошибочные)
    try {
      await saveResult(record)
    } catch (saveErr) {
      console.error(`  ✗ Не удалось сохранить результат: ${saveErr}`)
    }
  }

  console.log('\n✓ Пайплайн завершён')
}

runPipeline()
