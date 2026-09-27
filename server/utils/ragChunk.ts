/**
 * server/utils/ragChunk.ts
 *
 * Часть 2 RAG — Этап 2: нарезка SourceDocument[] на DocumentChunk[].
 *
 * Стратегия по форматам:
 *
 *   PDF  — жадная группировка соседних страниц до TARGET_CHARS.
 *           Metadata: pageStart / pageEnd (первая и последняя страница группы).
 *           Без overlap между группами (презентация, страницы независимы).
 *
 *   PPTX — жадная группировка соседних слайдов до TARGET_CHARS.
 *           Metadata: slideStart / slideEnd.
 *           Короткие слайды (заголовки, финал) объединяются с соседними,
 *           пока суммарный размер ≤ MAX_CHARS.
 *
 *   XLSX — один chunk на лист (листы никогда не смешиваются).
 *           Если лист > MAX_CHARS — разбивается по строкам с overlap.
 *           Metadata: sheet (имя листа).
 *
 *   DOCX — полный текст разбивается на чанки с overlap (~75 токенов).
 *           Предпочтительные точки разрыва: \n\n, \n, ". ".
 *
 * Оценка токенов:
 *   ~3 символа / токен (приближение для кириллического текста).
 *   Для точного счёта замените estimateTokens() на tiktoken cl100k_base.
 *
 * Source uniqueness:
 *   source имеет вид "project/basename", например "alisa/presentation.pdf",
 *   что исключает конфликт файлов с одинаковым basename из разных проектов.
 */

import { extname } from 'node:path'
import type { SourceDocument, DocumentChunk, Project } from '../../types/index'
import { parseDocument, scanDocs } from './ragIngest'

// ─── Константы ────────────────────────────────────────────────────────────────

/** ~3 символа/токен — консервативное приближение для кириллицы */
export const CHARS_PER_TOKEN = 3

const TARGET_TOKENS  = 600   // середина диапазона 400–800
const MAX_TOKENS     = 800
const OVERLAP_TOKENS = 75

const TARGET_CHARS   = TARGET_TOKENS  * CHARS_PER_TOKEN   // 1 800
const MAX_CHARS      = MAX_TOKENS     * CHARS_PER_TOKEN   // 2 400
const OVERLAP_CHARS  = OVERLAP_TOKENS * CHARS_PER_TOKEN   // 225

// ─── Оценка токенов ───────────────────────────────────────────────────────────

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

// ─── Разбивка текста ──────────────────────────────────────────────────────────

/**
 * Разбивает строку на чанки ≤ maxChars, стараясь не рвать
 * предложения. Граница ищется в последних 40% окна:
 *   \n\n > \n > ". " > " "
 * overlapChars символов из конца предыдущего чанка повторяются
 * в начале следующего (0 = без overlap).
 */
export function splitText(text: string, maxChars: number, overlapChars: number): string[] {
  const src = text.trim()
  if (!src) return []
  if (src.length <= maxChars) return [src]

  const chunks: string[] = []
  let start = 0

  while (start < src.length) {
    const rawEnd = Math.min(start + maxChars, src.length)
    let end = rawEnd

    if (rawEnd < src.length) {
      const scanFrom = start + Math.floor(maxChars * 0.6)
      const area = src.slice(scanFrom, rawEnd)
      const dn = area.lastIndexOf('\n\n')
      const sn = area.lastIndexOf('\n')
      const ps = area.lastIndexOf('. ')
      const sp = area.lastIndexOf(' ')
      let offset = -1
      if      (dn !== -1) offset = dn + 2
      else if (sn !== -1) offset = sn + 1
      else if (ps !== -1) offset = ps + 2
      else if (sp !== -1) offset = sp + 1
      if (offset !== -1) end = scanFrom + offset
    }

    const chunk = src.slice(start, end).trim()
    if (chunk) chunks.push(chunk)

    // Tail bug fix: если этот chunk уже дошёл до конца текста (end === src.length),
    // это ПОСЛЕДНИЙ chunk — выходим немедленно. Без этой проверки
    // nextStart = end - overlapChars мог оказаться одновременно > start
    // (не срабатывал break ниже) и < src.length, из-за чего цикл создавал
    // ещё одну, лишнюю итерацию — chunk-«хвост», состоящий только из
    // overlap-области предыдущего chunk (дубликат его конца).
    if (end >= src.length) break

    const nextStart = end - overlapChars
    if (nextStart <= start) break
    start = nextStart
  }

  return chunks
}

// ─── Chunker: PDF ─────────────────────────────────────────────────────────────

/**
 * Жадная группировка страниц до TARGET_CHARS.
 * Если отдельная страница > MAX_CHARS — разбивается без overlap.
 * Metadata: pageStart = первая страница группы, pageEnd = последняя.
 */
function chunkPdf(docs: SourceDocument[]): DocumentChunk[] {
  const sorted = [...docs].sort((a, b) => (a.page ?? 0) - (b.page ?? 0))
  if (sorted.length === 0) return []

  const { source, project } = sorted[0]!
  const chunks: DocumentChunk[] = []
  let chunkIndex = 0

  let groupTexts: string[] = []
  let groupFirstPage: number | undefined
  let groupLastPage: number | undefined
  let groupChars = 0

  function flushGroup() {
    if (groupTexts.length === 0) return
    const text = groupTexts.join('\n').trim()
    if (text) {
      chunks.push({
        source, project, chunkIndex: chunkIndex++, text,
        pageStart: groupFirstPage, pageEnd: groupLastPage,
      })
    }
    groupTexts = []
    groupFirstPage = undefined
    groupLastPage = undefined
    groupChars = 0
  }

  for (const doc of sorted) {
    const page = doc.page  // SourceDocument.page — реальный номер страницы в PDF
    const len = doc.text.length

    if (len > MAX_CHARS) {
      flushGroup()
      const parts = splitText(doc.text, MAX_CHARS, 0)
      for (const part of parts) {
        chunks.push({ source, project, chunkIndex: chunkIndex++, text: part, pageStart: page, pageEnd: page })
      }
      continue
    }

    const sep = groupTexts.length > 0 ? 1 : 0
    if (groupChars + sep + len > MAX_CHARS && groupTexts.length > 0) {
      flushGroup()
    }

    if (groupFirstPage === undefined) groupFirstPage = page
    groupLastPage = page
    groupTexts.push(doc.text)
    groupChars += sep + len
  }

  flushGroup()
  return chunks
}

// ─── Chunker: PPTX ───────────────────────────────────────────────────────────

/**
 * Жадная группировка слайдов до TARGET_CHARS.
 * Короткие слайды (заголовки, финальный «Конец») объединяются с соседними,
 * пока суммарный размер ≤ MAX_CHARS. При достижении TARGET_CHARS — сброс группы.
 *
 * Обоснование: не смешиваем явно разные темы, но и не создаём
 * бессодержательные chunks из единичных заголовков.
 *
 * Metadata: slideStart = первый слайд группы, slideEnd = последний.
 */
function chunkPptx(docs: SourceDocument[]): DocumentChunk[] {
  const sorted = [...docs].sort((a, b) => (a.slide ?? 0) - (b.slide ?? 0))
  if (sorted.length === 0) return []

  const { source, project } = sorted[0]!
  const chunks: DocumentChunk[] = []
  let chunkIndex = 0

  let groupTexts: string[] = []
  let groupSlideStart: number | undefined
  let groupSlideEnd: number | undefined
  let groupChars = 0

  function flushGroup() {
    if (groupTexts.length === 0) return
    const text = groupTexts.join('\n').trim()
    if (text) {
      chunks.push({
        source, project, chunkIndex: chunkIndex++, text,
        slideStart: groupSlideStart, slideEnd: groupSlideEnd,
      })
    }
    groupTexts = []
    groupSlideStart = undefined
    groupSlideEnd = undefined
    groupChars = 0
  }

  for (const doc of sorted) {
    const slide = doc.slide
    const len = doc.text.trim().length

    // Если слайд сам по себе крупнее лимита (крайний случай) — выделяем отдельно
    if (len > MAX_CHARS) {
      flushGroup()
      const parts = splitText(doc.text, MAX_CHARS, 0)
      for (const part of parts) {
        chunks.push({ source, project, chunkIndex: chunkIndex++, text: part, slideStart: slide, slideEnd: slide })
      }
      continue
    }

    // Если добавление слайда превысит MAX_CHARS — сбрасываем группу
    const sep = groupTexts.length > 0 ? 1 : 0
    if (groupChars + sep + len > MAX_CHARS && groupTexts.length > 0) {
      flushGroup()
    }

    if (groupSlideStart === undefined) groupSlideStart = slide
    groupSlideEnd = slide
    if (doc.text.trim()) groupTexts.push(doc.text.trim())
    groupChars += sep + len

    // Жадный сброс: достигли TARGET_CHARS — начинаем новую группу
    if (groupChars >= TARGET_CHARS) {
      flushGroup()
    }
  }

  flushGroup()
  return chunks
}

// ─── Chunker: XLSX ────────────────────────────────────────────────────────────

/**
 * Один chunk на лист. Листы никогда не смешиваются.
 * Если лист > MAX_CHARS — разбивается по строкам с overlap.
 */
function chunkXlsx(docs: SourceDocument[]): DocumentChunk[] {
  const chunks: DocumentChunk[] = []
  let chunkIndex = 0

  for (const doc of docs) {
    const parts = doc.text.length > MAX_CHARS
      ? splitText(doc.text, MAX_CHARS, OVERLAP_CHARS)
      : [doc.text.trim()]

    for (const part of parts) {
      if (part) chunks.push({ source: doc.source, project: doc.project, chunkIndex: chunkIndex++, text: part, sheet: doc.sheet })
    }
  }

  return chunks
}

// ─── Chunker: DOCX ───────────────────────────────────────────────────────────

/**
 * Весь текст разбивается на чанки с overlap.
 * Предпочтительные точки разрыва: абзацы (\n\n), строки (\n), предложения.
 */
function chunkDocx(docs: SourceDocument[]): DocumentChunk[] {
  const chunks: DocumentChunk[] = []
  let chunkIndex = 0

  for (const doc of docs) {
    const parts = doc.text.length <= MAX_CHARS
      ? [doc.text.trim()]
      : splitText(doc.text, MAX_CHARS, OVERLAP_CHARS)

    for (const part of parts) {
      if (part) chunks.push({ source: doc.source, project: doc.project, chunkIndex: chunkIndex++, text: part })
    }
  }

  return chunks
}

// ─── Публичный API ────────────────────────────────────────────────────────────

/**
 * Превращает SourceDocument[] в DocumentChunk[].
 * Выбирает стратегию нарезки по расширению source-файла.
 * chunkIndex — сквозной 0-based в пределах одного source.
 */
export function chunkDocuments(docs: SourceDocument[]): DocumentChunk[] {
  // Группируем по source (= "project/filename", уникален)
  const order: string[] = []
  const bySource = new Map<string, SourceDocument[]>()
  for (const doc of docs) {
    if (!bySource.has(doc.source)) {
      order.push(doc.source)
      bySource.set(doc.source, [])
    }
    bySource.get(doc.source)!.push(doc)
  }

  const all: DocumentChunk[] = []
  for (const source of order) {
    const sourceDocs = bySource.get(source)!
    // Расширение берём из basename (после "project/")
    const basename = source.includes('/') ? source.split('/').pop()! : source
    const ext = extname(basename).toLowerCase()

    let chunks: DocumentChunk[]
    switch (ext) {
      case '.pdf':  chunks = chunkPdf(sourceDocs);  break
      case '.pptx': chunks = chunkPptx(sourceDocs); break
      case '.xlsx': chunks = chunkXlsx(sourceDocs); break
      // .md/.markdown — сплошной текст, как DOCX: та же text-chunking стратегия
      // (splitText с overlap), без специального Markdown-парсинга.
      case '.docx':
      case '.md':
      case '.markdown':
        chunks = chunkDocx(sourceDocs); break
      default:
        throw new Error(`ragChunk: неподдерживаемый формат "${ext}" (${source})`)
    }
    all.push(...chunks)
  }

  return all
}

/**
 * Сканирует папку документов, парсит каждый файл и возвращает DocumentChunk[].
 * Используется в следующих этапах (embeddings и т.п.).
 */
export async function parseAndChunkAll(docsPath: string): Promise<DocumentChunk[]> {
  const entries = await scanDocs(docsPath)
  const allDocs: SourceDocument[] = []
  for (const { filePath, project } of entries) {
    const docs = await parseDocument(filePath, project)
    allDocs.push(...docs)
  }
  return chunkDocuments(allDocs)
}
