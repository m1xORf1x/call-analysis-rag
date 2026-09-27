/**
 * server/utils/ragIngest.ts
 *
 * Часть 2 RAG — Этап 1: извлечение текста из документов знаний.
 *
 * Поддерживаемые форматы:
 *   PDF      → одна SourceDocument на страницу (pdf-parse v2 / pdfjs)
 *   DOCX     → одна SourceDocument на весь документ (mammoth)
 *   PPTX     → одна SourceDocument на слайд (jszip + XML <a:t>)
 *   XLSX     → одна SourceDocument на лист (xlsx / SheetJS)
 *   MD/MARKDOWN → одна SourceDocument на весь файл (обычный UTF-8 текст,
 *                 без специального парсинга Markdown-синтаксиса)
 *
 * Структура data/docs/:
 *   data/docs/alisa/      → project = 'alisa'
 *   data/docs/bestseller/ → project = 'bestseller'
 *
 * Не изменяет pipeline Part 1. Не делает embeddings / chunking / vector storage.
 */

import { readFile, readdir } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import type { SourceDocument, Project } from '../../types/index'

// Инициализируем pdf.js worker один раз при загрузке модуля.
// В Node.js окружении setWorker() без аргументов использует встроенный воркер.
PDFParse.setWorker()

// ─── PDF ──────────────────────────────────────────────────────────────────────

/**
 * Парсит PDF-файл и возвращает массив SourceDocument — по одному на страницу.
 * Страницы без текстового слоя (изображения) пропускаются.
 */
async function parsePdf(filePath: string, source: string, project: Project): Promise<SourceDocument[]> {
  const buffer = await readFile(filePath)
  const parser = new PDFParse({ data: buffer, verbosity: 0 })

  try {
    // pageJoiner: '' — убирает разделитель "-- N of M --" между страницами в result.text
    const result = await parser.getText({ pageJoiner: '' })

    return result.pages
      .map(p => ({ page: p.num, text: p.text.trim() }))
      .filter(p => p.text.length > 0)
      .map(p => ({ source, project, text: p.text, page: p.page }))
  } finally {
    await parser.destroy()
  }
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────

/**
 * Парсит DOCX-файл через mammoth и возвращает одну SourceDocument со всем текстом.
 */
async function parseDocx(filePath: string, source: string, project: Project): Promise<SourceDocument[]> {
  const result = await mammoth.extractRawText({ path: filePath })
  const text = result.value.trim()
  if (!text) return []
  return [{ source, project, text }]
}

// ─── PPTX ─────────────────────────────────────────────────────────────────────

/**
 * Регулярное выражение для извлечения текста из элементов DrawingML <a:t>.
 * Это стандартный XML-элемент для текста в PPTX/XLSX (Office Open XML).
 */
const AT_TAG_RE = /<a:t[^>]*>([^<]*)<\/a:t>/g

/**
 * Парсит PPTX-файл: открывает ZIP, извлекает XML каждого слайда,
 * и возвращает массив SourceDocument — по одному на слайд.
 * Слайды без текста пропускаются.
 */
async function parsePptx(filePath: string, source: string, project: Project): Promise<SourceDocument[]> {
  const buffer = await readFile(filePath)
  const zip = await JSZip.loadAsync(buffer)

  // Собираем имена файлов слайдов и сортируем по номеру
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/(\d+)/)?.[1] ?? '0', 10)
      const numB = parseInt(b.match(/(\d+)/)?.[1] ?? '0', 10)
      return numA - numB
    })

  const docs: SourceDocument[] = []
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]]!.async('string')
    AT_TAG_RE.lastIndex = 0
    const texts: string[] = []
    let match: RegExpExecArray | null
    while ((match = AT_TAG_RE.exec(xml)) !== null) {
      const t = match[1]!.trim()
      if (t) texts.push(t)
    }
    const text = texts.join(' ').trim()
    if (text) {
      docs.push({ source, project, text, slide: i + 1 })
    }
  }

  return docs
}

// ─── XLSX ─────────────────────────────────────────────────────────────────────

/**
 * Парсит XLSX-файл через SheetJS и возвращает массив SourceDocument —
 * по одному на лист. Листы без данных пропускаются.
 *
 * Строки представляются в виде значений, разделённых табуляцией,
 * что сохраняет структуру таблицы в читаемом виде.
 */
async function parseXlsx(filePath: string, source: string, project: Project): Promise<SourceDocument[]> {
  const buffer = await readFile(filePath)
  const workbook = XLSX.read(buffer)
  const docs: SourceDocument[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    // header: 1 → строки как массивы значений; defval: '' → пустые ячейки = ''
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(sheet, {
      header: 1,
      defval: '',
    })

    const text = rows
      .filter(row => row.some(cell => String(cell).trim() !== ''))
      .map(row => row.map(cell => String(cell).trim()).join('\t'))
      .join('\n')
      .trim()

    if (text) {
      docs.push({ source, project, text, sheet: sheetName })
    }
  }

  return docs
}

// ─── Markdown ─────────────────────────────────────────────────────────────────

/**
 * Парсит .md/.markdown файл как обычный UTF-8 текст.
 *
 * Специальный парсинг Markdown-синтаксиса не требуется: достаточно корректно
 * прочитать текст (заголовки/списки/ссылки остаются как обычные символы
 * в исходном виде). Дальше файл проходит ту же text-chunking стратегию,
 * что и DOCX.
 */
async function parseMarkdown(filePath: string, source: string, project: Project): Promise<SourceDocument[]> {
  const raw = await readFile(filePath, 'utf-8')
  const text = raw.trim()
  if (!text) return []
  return [{ source, project, text }]
}

// ─── Диспетчер по расширению ──────────────────────────────────────────────────

/** Расширения файлов, поддерживаемых парсером. */
export const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.pptx', '.xlsx', '.md', '.markdown'])

/**
 * Парсит файл в массив SourceDocument.
 * @throws Если расширение файла не поддерживается.
 */
export async function parseDocument(filePath: string, project: Project): Promise<SourceDocument[]> {
  const ext = extname(filePath).toLowerCase()
  // Включаем project в source, чтобы два файла с одинаковым basename никогда не конфликтовали:
  //   alisa/presentation.pdf  vs  bestseller/presentation.pdf
  const source = `${project}/${basename(filePath)}`

  switch (ext) {
    case '.pdf':
      return parsePdf(filePath, source, project)
    case '.docx':
      return parseDocx(filePath, source, project)
    case '.pptx':
      return parsePptx(filePath, source, project)
    case '.xlsx':
      return await parseXlsx(filePath, source, project)
    case '.md':
    case '.markdown':
      return parseMarkdown(filePath, source, project)
    default:
      throw new Error(`ragIngest: неподдерживаемый формат файла "${ext}" (${filePath})`)
  }
}

// ─── Сканирование папок ───────────────────────────────────────────────────────

/** Результат сканирования одного файла документа. */
export interface DocEntry {
  filePath: string
  project: Project
}

/**
 * Рекурсивно сканирует data/docs/ и возвращает список файлов поддерживаемых форматов.
 * Определяет project из имени поддиректории (alisa | bestseller).
 *
 * @param docsPath — путь к корневой папке документов (data/docs)
 */
export async function scanDocs(docsPath: string): Promise<DocEntry[]> {
  const KNOWN_PROJECTS: Project[] = ['alisa', 'bestseller']
  const entries: DocEntry[] = []

  for (const project of KNOWN_PROJECTS) {
    const projectDir = join(docsPath, project)
    let files: string[]
    try {
      files = await readdir(projectDir)
    } catch {
      // Папка не существует — пропускаем
      continue
    }

    for (const file of files) {
      const ext = extname(file).toLowerCase()
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        entries.push({ filePath: join(projectDir, file), project })
      }
    }
  }

  return entries
}
