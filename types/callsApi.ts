import type { CallAnalysis, CallStatus } from './index'
import type { CommunicationRow } from '~/data/mockCommunications'

/** GET /api/calls */
export interface CallsListResponse {
  calls: CommunicationRow[]
}

/** GET /api/calls/:id */
export interface CallDetailResponse {
  id: string
  filename: string
  duration_sec: number
  content_type: string
  status: CallStatus
  statusLabel: string
  transcript: string | null
  analysis: CallAnalysis | null
  error: string | null
}
