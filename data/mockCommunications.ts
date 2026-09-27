/**
 * View-model для главной таблицы коммуникаций (Figma columns).
 *
 * Реальные поля — из ExportedCallRecord / CallAnalysis.
 * CRM-колонки Figma сохранены в layout, но без mock-значений (— / пусто).
 */

import type { ExportedCallRecord } from '~/types/callsExport'
import type { CallStatus } from '~/types/index'
import { formatDuration, filenameLabel } from '~/utils/callFormat'
import { callStatusLabel } from '~/utils/callStatusLabel'

export type Tone = 'green' | 'blue' | 'red' | 'yellow' | 'gray' | 'purple'

export interface Tag {
  label: string
  tone: Tone
}

export interface CommunicationRow {
  id: string
  callId: string

  /** Реальное имя звонка (filename без расширения) */
  callName: string
  /** Реальный pipeline status (UI label) */
  statusLabel: string
  status: CallStatus
  durationLabel: string

  /** Figma columns без источника — всегда нейтральные placeholder */
  channel: string
  type: string
  mql: Tag | null
  sql: Tag | null
  crmLead: Tag | null
  contactPhone: string
  manager: string
  score: number | null
  scoreTone: Tone
  labels: Tag[]
  city: string
  source: string
  managerTalkPct: number | null
  clientTalkPct: number | null
  department: string

  /** Реальный summary из CallAnalysis или сообщение об ошибке */
  summary: string
}

export function buildCommunicationRows(calls: ExportedCallRecord[]): CommunicationRow[] {
  return calls.map((call) => {
    const summary = call.analysis?.summary
      ?? (call.error ? 'Не удалось обработать звонок' : '—')

    return {
      id: `row-${call.id}`,
      callId: call.id,
      callName: filenameLabel(call.filename),
      status: call.status,
      statusLabel: callStatusLabel(call.status),
      durationLabel: formatDuration(call.duration_sec),
      summary,
      channel: '—',
      type: '—',
      mql: null,
      sql: null,
      crmLead: null,
      contactPhone: '—',
      manager: '—',
      score: null,
      scoreTone: 'gray',
      labels: [],
      city: '—',
      source: '—',
      managerTalkPct: null,
      clientTalkPct: null,
      department: '—',
    }
  })
}
