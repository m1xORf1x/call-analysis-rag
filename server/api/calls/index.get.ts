import { buildCommunicationRows } from '../../../data/mockCommunications'
import { getAllExportedCalls } from '../../utils/callsSnapshot'
import type { CallsListResponse } from '../../../types/callsApi'

export default defineEventHandler((): CallsListResponse => {
  const calls = getAllExportedCalls()
  return { calls: buildCommunicationRows(calls) }
})
