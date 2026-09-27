/// <reference types="node" />
import 'dotenv/config'

/**
 * Переанализ звонков с уже сохранённым transcript (без STT).
 * Обновляет analysis_json в SQLite; далее — npm run export:calls.
 *
 * Запуск: npm run reanalyze:calls -- c_03 c_05
 */

import { analyseTranscript } from '../server/utils/bothub'
import { getCall, initDatabase, updateCallStatus } from '../server/utils/db'

async function main(): Promise<void> {
  const callIds = process.argv.slice(2)
  if (callIds.length === 0) {
    console.error('Usage: npm run reanalyze:calls -- c_03 c_05')
    process.exit(1)
  }

  initDatabase()

  for (const callId of callIds) {
    const row = getCall(callId)
    if (!row?.transcript) {
      throw new Error(`Call ${callId}: transcript отсутствует в SQLite`)
    }

    console.log(`▶ Re-analyze ${callId}...`)
    const analysis = await analyseTranscript(row.transcript)
    updateCallStatus(callId, {
      status: 'completed',
      analysisJson: JSON.stringify(analysis),
      error: null,
    })
    console.log(`  ✓ budget: ${analysis.client.budget ?? 'null'}`)
    console.log(`  ✓ competitors: ${JSON.stringify(analysis.client.competitors)}`)
  }
}

main().catch(err => {
  console.error('✗ Re-analyze failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
