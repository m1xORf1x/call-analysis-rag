/** Форматирует duration_sec → "M:СС" */
export function formatDuration(sec: number): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** ISO date → локализованная строка; отсутствие → «—» */
export function formatOptionalDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Имя файла без расширения — честный display-id, не выдуманное ФИО */
export function filenameLabel(filename: string): string {
  return filename.replace(/\.[^.]+$/, '')
}
