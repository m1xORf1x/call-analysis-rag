import callsExport from '../../data/calls.export.json'
import type { CallsExportFile, ExportedCallRecord } from '../../types/callsExport'

/** Snapshot из bundle (статический import — production-safe) */
const cachedCalls: ExportedCallRecord[] = (callsExport as CallsExportFile).calls

export function getAllExportedCalls(): ExportedCallRecord[] {
  return cachedCalls
}

export function getExportedCallById(id: string): ExportedCallRecord | undefined {
  return cachedCalls.find(call => call.id === id)
}
