import type { CallStatus } from '../types/index'

/**
 * SQLite pipeline status (scripts/pipeline.ts) → публичный CallStatus (types/index.ts).
 *
 * Pipeline пишет в SQLite:
 *   pending      — запись создана, обработка не начата
 *   transcribed  — STT выполнен
 *   completed    — LLM-анализ сохранён
 *   failed       — ошибка на любом шаге
 *
 * Публичная модель (UI, calls.export.json, GET /api/calls):
 *   pending | downloaded | transcribed | analyzed | error
 *
 * Статус downloaded предусмотрен контрактом, но текущий pipeline его не выставляет:
 * аудио скачивается in-memory и сразу передаётся в STT без отдельного шага persisted status.
 */
const PIPELINE_TO_PUBLIC: Record<string, CallStatus> = {
  pending: 'pending',
  transcribed: 'transcribed',
  completed: 'analyzed',
  failed: 'error',
  downloaded: 'downloaded',
}

/** Нормализует status из SQLite в публичный CallStatus. */
export function normalizePipelineStatus(sqliteStatus: string | undefined): CallStatus {
  if (!sqliteStatus) return 'pending'
  return PIPELINE_TO_PUBLIC[sqliteStatus] ?? 'pending'
}
