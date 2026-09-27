import type { CallStatus } from '~/types/index'

const STATUS_LABELS: Record<CallStatus, string> = {
  pending: 'Ожидание',
  downloaded: 'Скачан',
  transcribed: 'Транскрипт',
  analyzed: 'Разобран',
  error: 'Ошибка',
}

export function callStatusLabel(status: CallStatus): string {
  return STATUS_LABELS[status] ?? status
}
