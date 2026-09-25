/// <reference types="node" />
/**
 * server/utils/db.ts
 *
 * Слой работы с SQLite — хранение результатов обработки звонков.
 * Использует встроенный node:sqlite (DatabaseSync); внешние зависимости не требуются.
 *
 * Схема таблицы calls (минимальная, без лишних полей):
 *   call_id       TEXT PRIMARY KEY  — id звонка (совпадает с Call.id из Calls API)
 *   status        TEXT NOT NULL     — статус обработки; конкретный набор значений
 *                                     определяет вызывающий код (этот модуль не привязан к нему)
 *   transcript    TEXT              — транскрипт STT; NULL до транскрибации
 *   analysis_json TEXT              — результат LLM-анализа (CallAnalysis), сериализованный
 *                                     в JSON; NULL до анализа
 *   error         TEXT              — текст ошибки последнего неуспешного шага; NULL, если ошибок нет
 *
 * Путь к файлу БД: env DB_PATH (по умолчанию ./data/calls.db).
 * Директория для файла создаётся автоматически, если её нет.
 *
 * Статус: только слой доступа к БД. К pipeline пока не подключён.
 */

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const DEFAULT_DB_PATH = './data/calls.db'

let db: DatabaseSync | null = null

/**
 * Инициализирует подключение к SQLite и создаёт таблицу calls, если её ещё нет.
 * Идемпотентна: повторные вызовы возвращают уже открытое подключение без побочных эффектов.
 */
export function initDatabase(): DatabaseSync {
  if (db) return db

  const dbPath = process.env.DB_PATH?.trim() || DEFAULT_DB_PATH
  mkdirSync(dirname(dbPath), { recursive: true })

  const database = new DatabaseSync(dbPath)

  database.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      call_id       TEXT PRIMARY KEY,
      status        TEXT NOT NULL,
      transcript    TEXT,
      analysis_json TEXT,
      error         TEXT
    )
  `)

  db = database
  return db
}

// ─── Типы ─────────────────────────────────────────────────────────────────────

/** Строка таблицы calls. */
export interface CallRow {
  call_id: string
  status: string
  transcript: string | null
  analysis_json: string | null
  error: string | null
}

/** Преобразует «сырую» строку из node:sqlite в типизированный CallRow. */
function toCallRow(row: Record<string, unknown>): CallRow {
  return {
    call_id: row['call_id'] as string,
    status: row['status'] as string,
    transcript: (row['transcript'] as string | null) ?? null,
    analysis_json: (row['analysis_json'] as string | null) ?? null,
    error: (row['error'] as string | null) ?? null,
  }
}

// ─── Запросы ────────────────────────────────────────────────────────────────────

/**
 * Возвращает запись звонка по call_id, или null, если записи нет.
 */
export function getCall(callId: string): CallRow | null {
  const database = initDatabase()
  const row = database
    .prepare('SELECT call_id, status, transcript, analysis_json, error FROM calls WHERE call_id = ?')
    .get(callId)

  return row ? toCallRow(row) : null
}

/**
 * Создаёт новую запись звонка со статусом "pending".
 * Идемпотентна: если call_id уже существует, существующая запись не изменяется
 * (INSERT OR IGNORE) — повторный вызов безопасен.
 */
export function createCall(callId: string): void {
  const database = initDatabase()
  database
    .prepare('INSERT OR IGNORE INTO calls (call_id, status, transcript, analysis_json, error) VALUES (?, ?, NULL, NULL, NULL)')
    .run(callId, 'pending')
}

/** Поля, которые можно обновить у существующей записи звонка. */
export interface UpdateCallStatusInput {
  status: string
  transcript?: string | null
  analysisJson?: string | null
  error?: string | null
}

/**
 * Обновляет статус записи звонка и, опционально, transcript/analysis_json/error.
 * Поля, не переданные в input, остаются без изменений (частичное обновление).
 * Если записи с таким call_id не существует — строка не создаётся (см. createCall).
 */
export function updateCallStatus(callId: string, input: UpdateCallStatusInput): void {
  const database = initDatabase()

  const setClauses: string[] = ['status = ?']
  const params: Array<string | null> = [input.status]

  if ('transcript' in input) {
    setClauses.push('transcript = ?')
    params.push(input.transcript ?? null)
  }
  if ('analysisJson' in input) {
    setClauses.push('analysis_json = ?')
    params.push(input.analysisJson ?? null)
  }
  if ('error' in input) {
    setClauses.push('error = ?')
    params.push(input.error ?? null)
  }

  params.push(callId)

  database.prepare(`UPDATE calls SET ${setClauses.join(', ')} WHERE call_id = ?`).run(...params)
}
