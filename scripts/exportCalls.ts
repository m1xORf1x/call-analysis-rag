/// <reference types="node" />
import 'dotenv/config'

/**
 * scripts/exportCalls.ts
 *
 * Экспорт результатов Part 1 в статический JSON для public demo.
 * Только чтение: Calls API metadata + SQLite — без STT, LLM, pipeline, записи в БД.
 *
 * Запуск: npm run export:calls
 * Output: data/calls.export.json
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fetchCalls } from '../server/utils/callsApi'
import { getCall, initDatabase } from '../server/utils/db'
import type { CallAnalysis } from '../types/index'
import type { CallsExportFile, ExportedCallRecord } from '../types/callsExport'
import { normalizePipelineStatus } from '../utils/callStatusNormalize'

const OUTPUT_PATH = resolve('data/calls.export.json')

function parseAnalysis(raw: string, callId: string): CallAnalysis {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Call ${callId}: analysis_json is not valid JSON`)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Call ${callId}: analysis_json is not an object`)
  }

  return parsed as CallAnalysis
}

function buildExportedCall(
  call: { id: string; filename: string; duration_sec: number; content_type: string },
): ExportedCallRecord {
  initDatabase()
  const row = getCall(call.id)

  const status = normalizePipelineStatus(row?.status)
  const transcript = row?.transcript ?? null
  const error = row?.error ?? null
  const analysis = row?.analysis_json ? parseAnalysis(row.analysis_json, call.id) : null

  return {
    id: call.id,
    filename: call.filename,
    duration_sec: call.duration_sec,
    content_type: call.content_type,
    status,
    transcript,
    analysis,
    error,
  }
}

async function main(): Promise<void> {
  console.log('▶ Export calls → data/calls.export.json\n')

  const apiCalls = await fetchCalls()
  console.log(`  Calls API: ${apiCalls.length} звонков`)

  const calls = apiCalls.map(buildExportedCall)
  const payload: CallsExportFile = { calls }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  const ok = calls.filter(c => c.status === 'analyzed').length
  const failed = calls.filter(c => c.status === 'error').length
  console.log(`  ✓ Записано: ${calls.length} (analyzed: ${ok}, error: ${failed})`)
  console.log(`  ✓ Файл: ${OUTPUT_PATH}`)
}

main().catch(err => {
  console.error('✗ Export failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
