import { callStatusLabel } from '../../utils/callStatusLabel'
import { getExportedCallById } from '../../utils/callsSnapshot'
import type { CallDetailResponse } from '../../../types/callsApi'

export default defineEventHandler((event): CallDetailResponse => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Call id is required' })
  }

  const call = getExportedCallById(id)
  if (!call) {
    throw createError({ statusCode: 404, statusMessage: 'Call not found' })
  }

  return {
    ...call,
    statusLabel: callStatusLabel(call.status),
  }
})
