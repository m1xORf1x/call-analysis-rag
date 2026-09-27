/**
 * Precomputed snapshot Part 1 для public demo (data/calls.export.json).
 *
 * Намеренно уже CallRecord: без created_at / updated_at и прочих UI-only полей,
 * которых нет в Calls API + SQLite pipeline.
 */
import type { Call, CallAnalysis, CallStatus } from './index'

/** Одна запись в calls.export.json */
export interface ExportedCallRecord extends Call {
  /**
   * Публичный CallStatus после normalizePipelineStatus():
   * SQLite completed → analyzed, failed → error, transcribed → transcribed.
   * downloaded в текущем pipeline не выставляется.
   */
  status: CallStatus
  transcript: string | null
  analysis: CallAnalysis | null
  error: string | null
}

/** Корневой объект data/calls.export.json */
export interface CallsExportFile {
  calls: ExportedCallRecord[]
}
