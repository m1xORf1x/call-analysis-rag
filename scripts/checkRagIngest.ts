/**
 * scripts/checkRagIngest.ts
 *
 * Диагностическая проверка первого этапа RAG: парсинг документов.
 *
 * Что проверяет:
 *   ✓ Находит все документы в data/docs/alisa/ и data/docs/bestseller/
 *   ✓ Парсит каждый документ (PDF / DOCX / PPTX / XLSX)
 *   ✓ Выводит статистику: кол-во страниц/слайдов/листов, объём текста
 *   ✓ Показывает превью первых 300 символов извлечённого текста
 *
 * Не делает: embeddings, chunking, vector storage, изменения Part 1.
 *
 * Запуск: npm run rag:ingest:check
 */

import { parseDocument, scanDocs } from '../server/utils/ragIngest'
import type { SourceDocument } from '../types/index'

const DOCS_PATH = './data/docs'
const PREVIEW_LENGTH = 300

// ─── Утилиты вывода ───────────────────────────────────────────────────────────

function preview(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  return trimmed.length <= PREVIEW_LENGTH
    ? trimmed
    : trimmed.slice(0, PREVIEW_LENGTH) + '…'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Описание структуры документов ───────────────────────────────────────────

function describeUnits(docs: SourceDocument[]): string {
  if (docs.length === 0) return '(нет текста)'
  const first = docs[0]!
  if (first.page !== undefined) return `${docs.length} стр.`
  if (first.slide !== undefined) return `${docs.length} слайд(ов)`
  if (first.sheet !== undefined) {
    const sheets = docs.map(d => d.sheet).join(', ')
    return `${docs.length} лист(ов): ${sheets}`
  }
  return `${docs.length} блок(ов)`
}

// ─── Главная функция ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║           RAG Ingestion Check — этап 1: парсинг             ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`  Папка документов: ${DOCS_PATH}`)
  console.log()

  // Сканируем папки
  const entries = await scanDocs(DOCS_PATH)
  if (entries.length === 0) {
    console.error('  ✗ Документы не найдены. Проверьте наличие папок data/docs/alisa/ и data/docs/bestseller/.')
    process.exit(1)
  }
  console.log(`  Найдено файлов: ${entries.length}`)
  console.log()

  // Сводные счётчики
  let totalFiles = 0
  let totalUnits = 0
  let totalChars = 0
  let failedFiles = 0

  // Парсим каждый файл
  for (const { filePath, project } of entries) {
    const shortPath = filePath.replace(/^\.\//, '')
    console.log(`──────────────────────────────────────────────────────────────`)
    console.log(`  📄 ${shortPath}`)
    console.log(`     Проект: ${project}`)

    const start = Date.now()
    let docs: SourceDocument[]

    try {
      docs = await parseDocument(filePath, project)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`     ✗ Ошибка парсинга: ${msg}`)
      failedFiles++
      continue
    }

    const elapsed = Date.now() - start
    const totalText = docs.reduce((sum, d) => sum + d.text.length, 0)
    const units = describeUnits(docs)

    console.log(`     Структура: ${units}`)
    console.log(`     Объём текста: ${totalText.toLocaleString('ru')} символов (${formatBytes(totalText * 2)})`)
    console.log(`     Время парсинга: ${elapsed} мс`)

    // Превью первой единицы
    if (docs.length > 0) {
      const firstDoc = docs[0]!
      const unitLabel = firstDoc.page !== undefined
        ? `стр. ${firstDoc.page}`
        : firstDoc.slide !== undefined
          ? `слайд ${firstDoc.slide}`
          : firstDoc.sheet !== undefined
            ? `лист "${firstDoc.sheet}"`
            : 'блок 1'
      console.log(`     Превью (${unitLabel}): «${preview(firstDoc.text)}»`)
    }

    totalFiles++
    totalUnits += docs.length
    totalChars += totalText
  }

  // Итоговая сводка
  console.log()
  console.log('══════════════════════════════════════════════════════════════')
  console.log('  ИТОГ')
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`  Файлов обработано:  ${totalFiles} / ${entries.length}`)
  if (failedFiles > 0) {
    console.log(`  Файлов с ошибками:  ${failedFiles}`)
  }
  console.log(`  Итого единиц:       ${totalUnits} (стр. / слайдов / листов / блоков)`)
  console.log(`  Итого текста:       ${totalChars.toLocaleString('ru')} символов`)
  console.log()

  if (failedFiles > 0) {
    console.log('  ✗ Некоторые файлы не распарсились — см. ошибки выше.')
    process.exit(1)
  } else {
    console.log('  ✓ Все файлы успешно распарсены.')
  }
}

main().catch(err => {
  console.error('\n✗ Неожиданная ошибка:', err instanceof Error ? err.message : err)
  process.exit(1)
})
