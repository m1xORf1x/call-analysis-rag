/// <reference types="node" />
import 'dotenv/config'
/**
 * scripts/checkRagRetrieve.ts
 *
 * Расширенная evaluation retrieval — 16 тестовых вопросов, Relevant@1/@3/@5.
 *
 * LLM не вызывается. Chunking/retrieval не изменяются.
 * Запуск: npm run rag:retrieve:check
 */

import { retrieveChunks } from '../server/utils/ragRetrieve'
import { ensurePayloadIndexes } from '../server/utils/ragStore'
import type { RetrievedChunk, Project } from '../types/index'

const TOP_K     = 5
const PREVIEW   = 280

// ─── Описание тестового вопроса ───────────────────────────────────────────────

interface TestQuery {
  question: string
  project?: Project
  /**
   * Ожидаемые источники: считаем результат «релевантным», если
   * source любого chunk из top-K содержит хотя бы одну из этих строк.
   * Для off-topic — пустой массив (offTopic: true).
   */
  relevantSources: string[]
  /** Если true — это вопрос не из базы; метрика не учитывается */
  offTopic?: boolean
  note?: string
}

// ─── Тестовые вопросы ────────────────────────────────────────────────────────

const TEST_QUERIES: TestQuery[] = [
  // ── Bestseller ──────────────────────────────────────────────────────────────
  {
    question:        'Какая ставка по семейной ипотеке?',
    project:         'bestseller',
    relevantSources: ['bestseller/sales_tools.docx'],
  },
  {
    question:        'Какой первоначальный взнос по семейной ипотеке?',
    project:         'bestseller',
    relevantSources: ['bestseller/sales_tools.docx'],
  },
  {
    question:        'Какие банки доступны для семейной ипотеки?',
    project:         'bestseller',
    relevantSources: ['bestseller/sales_tools.docx'],
  },
  {
    question:        'Как работает бризер?',
    project:         'bestseller',
    relevantSources: ['bestseller/smart_home.pptx'],
  },
  {
    question:        'Как осуществляется проход на территорию?',
    project:         'bestseller',
    relevantSources: ['bestseller/smart_home.pptx'],
  },
  {
    question:        'Какие возможности есть у умного дома?',
    project:         'bestseller',
    relevantSources: ['bestseller/smart_home.pptx', 'bestseller/presentation.pdf'],
  },
  {
    question:        'Какая отделка доступна в квартирах?',
    project:         'bestseller',
    relevantSources: ['bestseller/sales_tools.docx', 'bestseller/presentation.pdf'],
  },

  // ── Alisa ───────────────────────────────────────────────────────────────────
  {
    question:        'Где находится ЖК Алиса?',
    project:         'alisa',
    relevantSources: ['alisa/presentation.pdf', 'alisa/knowledge.xlsx'],
  },
  {
    question:        'Когда сдаётся первая очередь?',
    project:         'alisa',
    relevantSources: ['alisa/knowledge.xlsx', 'alisa/presentation.pdf'],
  },
  {
    question:        'Что предусмотрено в паркинге?',
    project:         'alisa',
    relevantSources: ['alisa/knowledge.xlsx'],
    note:            'ожидаем лист "Паркинг"',
  },
  {
    question:        'Что есть во дворе?',
    project:         'alisa',
    relevantSources: ['alisa/presentation.pdf', 'alisa/knowledge.xlsx'],
  },
  {
    question:        'Какая инфраструктура находится рядом?',
    project:         'alisa',
    relevantSources: ['alisa/presentation.pdf', 'alisa/knowledge.xlsx'],
  },
  {
    question:        'Какие функции умного здания есть?',
    project:         'alisa',
    relevantSources: ['alisa/knowledge.xlsx', 'alisa/presentation.pdf'],
  },

  // ── Off-topic ────────────────────────────────────────────────────────────────
  {
    question:        'Есть ли у ЖК Алиса вертолётная площадка?',
    project:         'alisa',
    relevantSources: [],
    offTopic:        true,
    note:            '⚠ off-topic — нет в документах',
  },
  {
    question:        'Какой сейчас курс доллара?',
    relevantSources: [],
    offTopic:        true,
    note:            '⚠ off-topic',
  },
  {
    question:        'Какая погода завтра в Москве?',
    relevantSources: [],
    offTopic:        true,
    note:            '⚠ off-topic',
  },
]

// ─── Вспомогательные функции ──────────────────────────────────────────────────

function clip(text: string, len = PREVIEW): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= len ? t : t.slice(0, len) + '…'
}

function metaStr(c: RetrievedChunk): string {
  if (c.pageStart !== undefined) {
    const end = c.pageEnd !== undefined && c.pageEnd !== c.pageStart
    return end ? `стр.${c.pageStart}–${c.pageEnd}` : `стр.${c.pageStart}`
  }
  if (c.slideStart !== undefined) {
    const end = c.slideEnd !== undefined && c.slideEnd !== c.slideStart
    return end ? `слайды ${c.slideStart}–${c.slideEnd}` : `слайд ${c.slideStart}`
  }
  if (c.sheet !== undefined) return `лист "${c.sheet}"`
  return '—'
}

/** Проверяет, является ли chunk «релевантным» для данного вопроса */
function isRelevant(chunk: RetrievedChunk, query: TestQuery): boolean {
  return query.relevantSources.some(src => chunk.source.includes(src))
}

/** Находит позицию (1-based) первого релевантного chunk в результатах, или -1 */
function firstRelevantRank(results: RetrievedChunk[], query: TestQuery): number {
  for (let i = 0; i < results.length; i++) {
    if (isRelevant(results[i]!, query)) return i + 1
  }
  return -1
}

// ─── Сбор результатов ────────────────────────────────────────────────────────

interface QueryResult {
  query:   TestQuery
  chunks:  RetrievedChunk[]
  error?:  string
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const SEP  = '══════════════════════════════════════════════════════════════'
  const SEP2 = '──────────────────────────────────────────────────────────────'

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║    RAG Retrieve Evaluation — 16 вопросов, Relevant@K        ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`  Вопросов всего:    ${TEST_QUERIES.length}`)
  console.log(`  In-domain:         ${TEST_QUERIES.filter(q => !q.offTopic).length}`)
  console.log(`  Off-topic:         ${TEST_QUERIES.filter(q => q.offTopic).length}`)
  console.log()

  // Payload indexes
  process.stdout.write('  Payload indexes… ')
  await ensurePayloadIndexes()
  console.log('OK\n')

  // ── Прогон запросов ─────────────────────────────────────────────────────────
  const queryResults: QueryResult[] = []

  for (const query of TEST_QUERIES) {
    const filterLabel = query.project ? `[${query.project}]` : '[all]'
    const offLabel    = query.offTopic ? '  ⚠ off-topic' : ''
    const noteLabel   = query.note && !query.offTopic ? `  (${query.note})` : ''

    console.log(SEP)
    console.log(`  Вопрос: «${query.question}»`)
    console.log(`  Фильтр: ${filterLabel}${offLabel}${noteLabel}`)
    console.log(SEP2)

    let chunks: RetrievedChunk[] = []
    let error: string | undefined

    try {
      chunks = await retrieveChunks(query.question, { topK: TOP_K, project: query.project })
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }

    queryResults.push({ query, chunks, error })

    if (error) {
      console.log(`  ✗ Ошибка: ${error}`)
      console.log()
      continue
    }

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]!
      const relevantMark = (!query.offTopic && isRelevant(c, query)) ? ' ✓' : ''
      console.log()
      console.log(
        `  #${i + 1}  score=${c.score.toFixed(4)}  ${c.source}  ${metaStr(c)}${relevantMark}`,
      )
      console.log(`       «${clip(c.text)}»`)
    }
    console.log()
  }

  // ── Метрики Relevant@K ───────────────────────────────────────────────────────
  const inDomain  = queryResults.filter(r => !r.query.offTopic && !r.error)
  const offTopic  = queryResults.filter(r => r.query.offTopic  && !r.error)

  const N = inDomain.length

  // Relevant@K = доля вопросов, в top-K которых есть хотя бы один релевантный chunk
  function relevantAtK(k: number): number {
    const hits = inDomain.filter(r => firstRelevantRank(r.chunks, r.query) !== -1
      && firstRelevantRank(r.chunks, r.query) <= k).length
    return hits / N
  }

  const R1 = relevantAtK(1)
  const R3 = relevantAtK(3)
  const R5 = relevantAtK(5)

  // Подробный разбор по вопросам
  const inDomainDetails = inDomain.map(r => {
    const rank = firstRelevantRank(r.chunks, r.query)
    const firstRelScore = rank !== -1 ? r.chunks[rank - 1]!.score : null
    return { ...r, rank, firstRelScore }
  })

  // Off-topic: max score
  const offTopicMaxScores = offTopic.map(r => ({
    question: r.query.question,
    maxScore: r.chunks.length > 0 ? Math.max(...r.chunks.map(c => c.score)) : 0,
  }))

  // ── Вывод метрик ────────────────────────────────────────────────────────────
  console.log(SEP)
  console.log('  МЕТРИКИ RELEVANCE')
  console.log(SEP)
  console.log()
  console.log(`  In-domain вопросов:  ${N}`)
  console.log()
  console.log(`  Relevant@1  =  ${(R1 * 100).toFixed(0).padStart(3)}%  (${inDomain.filter(r => firstRelevantRank(r.chunks, r.query) === 1).length}/${N})`)
  console.log(`  Relevant@3  =  ${(R3 * 100).toFixed(0).padStart(3)}%  (${inDomain.filter(r => { const rk = firstRelevantRank(r.chunks, r.query); return rk !== -1 && rk <= 3 }).length}/${N})`)
  console.log(`  Relevant@5  =  ${(R5 * 100).toFixed(0).padStart(3)}%  (${inDomain.filter(r => { const rk = firstRelevantRank(r.chunks, r.query); return rk !== -1 && rk <= 5 }).length}/${N})`)

  // ── Подробный разбор по вопросам ────────────────────────────────────────────
  console.log()
  console.log(SEP2)
  console.log('  Score первого релевантного результата (in-domain):')
  console.log(SEP2)

  const goodScores: number[] = []
  const poorQuestions: string[] = []

  for (const d of inDomainDetails) {
    const { question } = d.query
    if (d.rank === -1) {
      console.log(`  MISS  score=—      rank=—  «${question}»`)
      poorQuestions.push(question)
    } else {
      const sc = d.firstRelScore!
      goodScores.push(sc)
      const rankStr = `rank=#${d.rank}`
      const label   = d.rank === 1 ? '' : ` ← not top-1`
      console.log(`  HIT   score=${sc.toFixed(4)}  ${rankStr}  «${question}»${label}`)
      if (d.rank > 3) poorQuestions.push(question)
    }
  }

  console.log()
  console.log(SEP2)
  console.log('  Off-topic — max score (чем ниже, тем лучше):')
  console.log(SEP2)

  const offScores: number[] = []
  for (const o of offTopicMaxScores) {
    offScores.push(o.maxScore)
    console.log(`  max=${o.maxScore.toFixed(4)}  «${o.question}»`)
  }

  // ── Score-диапазоны ─────────────────────────────────────────────────────────
  console.log()
  console.log(SEP)
  console.log('  ДИАПАЗОНЫ SCORE')
  console.log(SEP)

  const allInDomainScores = inDomain.flatMap(r => r.chunks.map(c => c.score))
  const allOffScores      = offTopic.flatMap(r => r.chunks.map(c => c.score))

  function stats(arr: number[]): string {
    if (arr.length === 0) return '—'
    const s = [...arr].sort((a, b) => a - b)
    const min = s[0]!, max = s[s.length - 1]!, avg = arr.reduce((a, b) => a + b, 0) / arr.length
    return `min=${min.toFixed(4)}  avg=${avg.toFixed(4)}  max=${max.toFixed(4)}`
  }

  console.log()
  console.log(`  In-domain top-5  (все chunks):  ${stats(allInDomainScores)}`)
  console.log(`  Off-topic top-1  (max/вопрос):  ${stats(offScores)}`)

  if (goodScores.length > 0) {
    const minGood = Math.min(...goodScores), maxGood = Math.max(...goodScores)
    const avgGood = goodScores.reduce((a, b) => a + b, 0) / goodScores.length
    console.log()
    console.log(`  Score первого релев. результата:`)
    console.log(`    min=${minGood.toFixed(4)}  avg=${avgGood.toFixed(4)}  max=${maxGood.toFixed(4)}`)
  }

  // Гистограмма (все scores вместе)
  const allScores = [...allInDomainScores, ...allOffScores]
  const buckets: [string, number][] = [
    ['≥0.70', 0], ['0.60–0.70', 0], ['0.50–0.60', 0],
    ['0.40–0.50', 0], ['0.30–0.40', 0], ['<0.30', 0],
  ]
  for (const s of allScores) {
    if      (s >= 0.70) buckets[0]![1]++
    else if (s >= 0.60) buckets[1]![1]++
    else if (s >= 0.50) buckets[2]![1]++
    else if (s >= 0.40) buckets[3]![1]++
    else if (s >= 0.30) buckets[4]![1]++
    else                buckets[5]![1]++
  }
  console.log()
  console.log('  Гистограмма score (in-domain + off-topic):')
  for (const [range, cnt] of buckets) {
    if (cnt === 0) continue
    const bar = '█'.repeat(Math.max(1, Math.round(cnt / allScores.length * 24)))
    console.log(`    ${range.padEnd(10)}  ${String(cnt).padStart(2)}  ${bar}`)
  }

  // ── Threshold candidates ─────────────────────────────────────────────────────
  console.log()
  console.log(SEP)
  console.log('  КАНДИДАТЫ НА SIMILARITY THRESHOLD')
  console.log(SEP)
  console.log()

  const offMax  = offScores.length > 0 ? Math.max(...offScores) : 0
  const goodMin = goodScores.length > 0 ? Math.min(...goodScores) : 1
  const gap     = goodMin - offMax

  console.log(`  Max score off-topic:              ${offMax.toFixed(4)}`)
  console.log(`  Min score первого релев. in-dom:  ${goodMin.toFixed(4)}`)
  console.log(`  Зазор:                            ${gap.toFixed(4)}`)
  console.log()

  if (gap > 0) {
    const mid       = offMax + gap / 2
    const aggr      = offMax + gap * 0.33   // агрессивный — режет больше off-topic
    const conserv   = offMax + gap * 0.67   // консервативный — режет меньше in-domain
    console.log(`  Предложения (не применять без дополнительного тестирования):`)
    console.log(`    Консервативный (минимум потерь in-domain): ${conserv.toFixed(3)}`)
    console.log(`    Сбалансированный:                          ${mid.toFixed(3)}`)
    console.log(`    Агрессивный (максимум фильтрации off-topic): ${aggr.toFixed(3)}`)
  } else {
    console.log('  ⚠ Зазора нет — off-topic и in-domain score перекрываются.')
    console.log('    Threshold не может разделить вопросы без ложных потерь.')
  }

  // ── Слабые места ────────────────────────────────────────────────────────────
  if (poorQuestions.length > 0) {
    console.log()
    console.log(SEP)
    console.log('  ЗАПРОСЫ, КОТОРЫЕ RETRIEVAL ОБРАБАТЫВАЕТ ПЛОХО')
    console.log(SEP)
    for (const q of poorQuestions) {
      console.log(`  • «${q}»`)
    }
  }

  console.log()
  console.log(SEP)
  console.log('  Готово. LLM не вызывался. Chunking/retrieval не изменялись.')
  console.log(SEP)
}

main().catch(err => {
  console.error('\n✗ Неожиданная ошибка:', err instanceof Error ? err.message : err)
  process.exit(1)
})
