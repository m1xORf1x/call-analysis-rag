/**
 * scripts/checkRagChunks.ts
 *
 * Диагностика Stage 2 RAG: chunking.
 * Выводит статистику по каждому документу и примеры чанков.
 *
 * Запуск: npm run rag:chunks:check
 */

import { parseAndChunkAll, estimateTokens, CHARS_PER_TOKEN } from '../server/utils/ragChunk'
import type { DocumentChunk } from '../types/index'

const DOCS_PATH = './data/docs'
const PREVIEW_LEN = 400

// Пороги предупреждений
const WARN_TOO_SMALL  = 50    // токенов
const WARN_TOO_LARGE  = 1000  // токенов

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function clip(text: string, len = PREVIEW_LEN): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= len ? t : t.slice(0, len) + '…'
}

/** Человекочитаемое описание metadata чанка */
function metaTag(chunk: DocumentChunk): string {
  if (chunk.pageStart !== undefined) {
    return chunk.pageEnd !== undefined && chunk.pageEnd !== chunk.pageStart
      ? `стр.${chunk.pageStart}–${chunk.pageEnd}`
      : `стр.${chunk.pageStart}`
  }
  if (chunk.slideStart !== undefined) {
    return chunk.slideEnd !== undefined && chunk.slideEnd !== chunk.slideStart
      ? `слайды ${chunk.slideStart}–${chunk.slideEnd}`
      : `слайд ${chunk.slideStart}`
  }
  if (chunk.sheet !== undefined) return `лист "${chunk.sheet}"`
  return '(без метаданных)'
}

function tokenBand(tokens: number): string {
  if (tokens < WARN_TOO_SMALL) return `⚠ <${WARN_TOO_SMALL}`
  if (tokens > WARN_TOO_LARGE) return `⚠ >${WARN_TOO_LARGE}`
  if (tokens < 100)  return `[<100]`
  if (tokens <= 400) return `[100–400]`
  if (tokens <= 800) return `[400–800 ✓]`
  return `[800–1000]`
}

// ─── Статистика ───────────────────────────────────────────────────────────────

interface Stats {
  count: number
  minTokens: number
  maxTokens: number
  totalTokens: number
  tooSmall: number
  tooLarge: number
}

function calcStats(chunks: DocumentChunk[]): Stats {
  if (chunks.length === 0) return { count: 0, minTokens: 0, maxTokens: 0, totalTokens: 0, tooSmall: 0, tooLarge: 0 }
  let minT = Infinity, maxT = 0, total = 0, small = 0, large = 0
  for (const c of chunks) {
    const t = estimateTokens(c.text)
    minT = Math.min(minT, t)
    maxT = Math.max(maxT, t)
    total += t
    if (t < WARN_TOO_SMALL)  small++
    if (t > WARN_TOO_LARGE)  large++
  }
  return { count: chunks.length, minTokens: minT, maxTokens: maxT, totalTokens: total, tooSmall: small, tooLarge: large }
}

function printStats(stats: Stats) {
  const avg = stats.count > 0 ? Math.round(stats.totalTokens / stats.count) : 0
  console.log(`     Chunks: ${stats.count}   Токены: min=${stats.minTokens}  avg=${avg}  max=${stats.maxTokens}`)
  if (stats.tooSmall > 0) console.log(`     ⚠ Слишком мелких (<${WARN_TOO_SMALL}т): ${stats.tooSmall}`)
  if (stats.tooLarge > 0) console.log(`     ⚠ Слишком крупных (>${WARN_TOO_LARGE}т): ${stats.tooLarge}`)
}

// ─── Примеры ──────────────────────────────────────────────────────────────────

function printSamples(chunks: DocumentChunk[], n = 3) {
  if (chunks.length === 0) return
  const indices = Array.from(new Set([
    0,
    Math.floor(chunks.length / 2),
    chunks.length - 1,
  ])).slice(0, n)

  console.log(`\n     ── Примеры ──`)
  for (const i of indices) {
    const c = chunks[i]!
    const t = estimateTokens(c.text)
    console.log(`     chunk[${c.chunkIndex}] ${metaTag(c)}  ${t}т ${tokenBand(t)}`)
    console.log(`       «${clip(c.text)}»`)
  }
}

// ─── Главная функция ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║           RAG Chunks Check — Stage 2: chunking              ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`  Оценка токенов: ~${CHARS_PER_TOKEN} символа/токен (приближение для кириллицы)`)
  console.log(`  Цель: 400–800 токенов/chunk,  overlap: ~75 токенов (PDF, XLSX, DOCX)`)
  console.log()

  const allChunks = await parseAndChunkAll(DOCS_PATH)

  // Группируем по source (= "project/filename")
  const order: string[] = []
  const bySource = new Map<string, DocumentChunk[]>()
  for (const c of allChunks) {
    if (!bySource.has(c.source)) { order.push(c.source); bySource.set(c.source, []) }
    bySource.get(c.source)!.push(c)
  }

  let globalTooSmall = 0
  let globalTooLarge = 0
  let pptxChunks: DocumentChunk[] = []

  for (const source of order) {
    const chunks = bySource.get(source)!
    const stats = calcStats(chunks)
    console.log(`──────────────────────────────────────────────────────────────`)
    console.log(`  📄 ${source}  [${chunks[0]?.project ?? '?'}]`)
    printStats(stats)
    printSamples(chunks)
    globalTooSmall += stats.tooSmall
    globalTooLarge += stats.tooLarge
    if (source.endsWith('.pptx')) pptxChunks = chunks
  }

  // Итоговая сводка
  const allStats = calcStats(allChunks)
  const avgAll = allStats.count > 0 ? Math.round(allStats.totalTokens / allStats.count) : 0

  console.log()
  console.log('══════════════════════════════════════════════════════════════')
  console.log('  ИТОГ')
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`  Источников:   ${bySource.size}`)
  console.log(`  Всего chunks: ${allStats.count}`)
  console.log(`  Токены:       min=${allStats.minTokens}  avg=${avgAll}  max=${allStats.maxTokens}`)

  // Гистограмма распределения
  const B: Record<string, number> = { '<50': 0, '50–100': 0, '100–400': 0, '400–800': 0, '800–1000': 0, '>1000': 0 }
  for (const c of allChunks) {
    const t = estimateTokens(c.text)
    if      (t < 50)   B['<50']!++
    else if (t < 100)  B['50–100']!++
    else if (t < 400)  B['100–400']!++
    else if (t < 800)  B['400–800']!++
    else if (t < 1000) B['800–1000']!++
    else               B['>1000']!++
  }
  console.log()
  console.log('  Распределение:')
  for (const [range, cnt] of Object.entries(B)) {
    if (cnt === 0) continue
    const bar = '█'.repeat(Math.round(cnt / allStats.count * 30))
    const warn = (range === '<50' || range === '>1000') ? ' ⚠' : ''
    console.log(`    ${range.padEnd(9)} ${String(cnt).padStart(3)} chunks  ${bar}${warn}`)
  }

  // Детальная секция PPTX
  if (pptxChunks.length > 0) {
    console.log()
    console.log('  ── PPTX: детали объединённых слайдов ──')
    for (const c of pptxChunks) {
      const t = estimateTokens(c.text)
      const range = c.slideStart !== undefined && c.slideEnd !== undefined && c.slideStart !== c.slideEnd
        ? `слайды ${c.slideStart}–${c.slideEnd}`
        : `слайд ${c.slideStart ?? '?'}`
      console.log(`    chunk[${c.chunkIndex}] ${range}  ${t}т`)
    }
  }

  console.log()
  if (globalTooSmall > 0) {
    console.log(`  ⚠ Мелких chunks (<${WARN_TOO_SMALL}т): ${globalTooSmall}`)
  }
  if (globalTooLarge > 0) {
    console.log(`  ⚠ Крупных chunks (>${WARN_TOO_LARGE}т): ${globalTooLarge}`)
  }
  if (globalTooSmall === 0 && globalTooLarge === 0) {
    console.log(`  ✓ Все chunks в допустимых пределах (нет chunks <${WARN_TOO_SMALL}т или >${WARN_TOO_LARGE}т).`)
  }
}

main().catch(err => {
  console.error('\n✗ Неожиданная ошибка:', err instanceof Error ? err.message : err)
  process.exit(1)
})
