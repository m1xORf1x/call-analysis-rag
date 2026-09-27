/// <reference types="node" />
import 'dotenv/config'
/**
 * scripts/checkRagAsk.ts
 *
 * Диагностика полного RAG pipeline: retrieval → LLM → citations.
 *
 * Прогоняет 5 тестовых вопросов через answerQuestion() и выводит:
 *   • question
 *   • answer от LLM
 *   • citations из реальных Qdrant-чанков
 *
 * LLM не придумывает citations — source и quote берутся из Qdrant metadata.
 *
 * Запуск: npm run rag:ask:check
 */

import { answerQuestion } from '../server/utils/ragAnswer'
import { ensurePayloadIndexes } from '../server/utils/ragStore'
import type { AnswerResult, Project } from '../types/index'

// ─── Тестовые вопросы ────────────────────────────────────────────────────────

interface TestQuestion {
  question: string
  project?: Project
  note?: string
}

const TEST_QUESTIONS: TestQuestion[] = [
  // ── Bestseller ─────────────────────────────────────────────────────────────
  {
    question: 'Какая ставка по семейной ипотеке в Бестселлере?',
    project:  'bestseller',
  },
  {
    question: 'Какой минимальный первоначальный взнос по семейной ипотеке?',
    project:  'bestseller',
  },
  {
    question: 'Как работает бризер в Бестселлере?',
    project:  'bestseller',
  },
  {
    question: 'Как можно попасть на территорию Бестселлера без обычного ключа?',
    project:  'bestseller',
  },
  // ── Alisa ──────────────────────────────────────────────────────────────────
  {
    question: 'Где находится ЖК Алиса?',
    project:  'alisa',
  },
  {
    question: 'Что предусмотрено в паркинге ЖК Алиса?',
    project:  'alisa',
  },
  // ── Off-topic ──────────────────────────────────────────────────────────────
  {
    question: 'Есть ли у ЖК Алиса вертолётная площадка?',
    project:  'alisa',
    note:     '⚠ off-topic',
  },
  {
    question: 'Можно ли купить квартиру за биткоины?',
    note:     '⚠ off-topic',
  },
]

// ─── Форматирование вывода ────────────────────────────────────────────────────

const SEP  = '══════════════════════════════════════════════════════════════'
const SEP2 = '──────────────────────────────────────────────────────────────'

function printResult(result: AnswerResult, question: TestQuestion, index: number): void {
  const filterLabel = question.project ? `[project: ${question.project}]` : '[all projects]'
  const noteLabel   = question.note ? `  ${question.note}` : ''

  console.log(SEP)
  console.log(`  #${index + 1}  Вопрос: «${result.question}»`)
  console.log(`       Фильтр: ${filterLabel}${noteLabel}`)
  console.log(SEP2)
  console.log()
  console.log('  Ответ:')
  // Перенос длинного ответа по строкам
  const lines = result.answer.split('\n')
  for (const line of lines) {
    console.log(`    ${line}`)
  }
  console.log()

  if (result.citations.length === 0) {
    console.log('  Citations: (нет)')
  } else {
    console.log(`  Citations (${result.citations.length}):`)
    for (let i = 0; i < result.citations.length; i++) {
      const c = result.citations[i]!
      console.log()
      console.log(`    [${i + 1}] ${c.source}`)
      console.log(`        «${c.quote}»`)
    }
  }
  console.log()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║    RAG Ask Check — LLM generation + citations               ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`  Вопросов: ${TEST_QUESTIONS.length}`)
  console.log(`  Model: ${process.env.BOTHUB_MODEL ?? '⚠ BOTHUB_MODEL не задан'}`)
  console.log()

  // Payload indexes (для project-фильтров)
  process.stdout.write('  Payload indexes… ')
  await ensurePayloadIndexes()
  console.log('OK\n')

  // Прогон вопросов
  let passed = 0
  let failed = 0

  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const q = TEST_QUESTIONS[i]!
    process.stdout.write(`  Вопрос ${i + 1}/${TEST_QUESTIONS.length}…\r`)

    let result: AnswerResult
    try {
      result = await answerQuestion(q.question, { project: q.project })
      passed++
    } catch (err) {
      failed++
      console.log(SEP)
      console.log(`  #${i + 1}  Вопрос: «${q.question}»`)
      console.log(`  ✗ Ошибка: ${err instanceof Error ? err.message : String(err)}`)
      console.log()
      continue
    }

    printResult(result, q, i)
  }

  // Итог
  console.log(SEP)
  console.log(`  Итог: ${passed} успешно, ${failed} ошибок`)
  console.log()
  console.log('  Pipeline: retrieval → LLM context → BotHub → citations')
  console.log('  source и quote в citations — из Qdrant metadata, не от LLM.')
  console.log(SEP)
}

main().catch(err => {
  console.error('\n✗ Неожиданная ошибка:', err instanceof Error ? err.message : err)
  process.exit(1)
})
