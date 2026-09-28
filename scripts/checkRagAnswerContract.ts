/// <reference types="node" />
/**
 * scripts/checkRagAnswerContract.ts
 *
 * Целевые тесты strict generation contract для resolveAnswer() —
 * БЕЗ реального HTTP-вызова к LLM (используются mock LLM-результаты).
 *
 * Проверяет:
 *   1. Содержательный answer + usedChunks: [] → система НЕ пропускает такой
 *      ответ пользователю (возвращается стандартный no-answer, citations: []).
 *   2. Invalid fragment для СУЩЕСТВУЮЩЕГО chunk id → citation невалидна,
 *      НЕ создаётся safeExcerpt-заглушка; итоговый ответ — no-answer.
 *   3. (контроль) Валидный точный fragment → citation verified, answer не меняется.
 *   4. (контроль) Fragment с иным whitespace → whitespace-tolerant match,
 *      quote — ОРИГИНАЛЬНАЯ подстрока chunk.text (не нормализованный fragment).
 *   5. (контроль) Malformed JSON от LLM → no-answer, citations: [].
 *
 * Запуск: npm run rag:contract:check
 */

import { resolveAnswer, parseStrictLlmJson, NO_ANSWER_TEXT } from '../server/utils/ragAnswer'
import { detectProject } from '../server/utils/ragProject'
import type { RetrievedChunk } from '../types/index'

function makeChunk(overrides: Partial<RetrievedChunk> & { text: string; source: string }): RetrievedChunk {
  return {
    score:      0.5,
    project:    'bestseller',
    chunkIndex: 0,
    ...overrides,
  }
}

let passed = 0
let failed = 0

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

function main(): void {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  RAG Answer Contract Check — strict generation + citations   ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()

  // ── Тест 1: содержательный answer + usedChunks: [] ──────────────────────────
  console.log('Тест 1: содержательный answer, usedChunks: [] (LLM не сослалась на чанки)')
  {
    const chunks: RetrievedChunk[] = [
      makeChunk({ text: 'Семейная ипотека без субсидий. Ставка: 6%. Мин ПВ: 20%.', source: 'bestseller/sales_tools.docx' }),
    ]
    const result = resolveAnswer('Какая ставка?', chunks, {
      answer:     'Ставка по семейной ипотеке — 6%.',
      usedChunks: [],
    })
    check('answer заменён на стандартный no-answer', result.answer === NO_ANSWER_TEXT, `получено: "${result.answer}"`)
    check('citations: []', result.citations.length === 0)
  }
  console.log()

  // ── Тест 2: invalid fragment для существующего chunk ────────────────────────
  console.log('Тест 2: invalid fragment для существующего chunk id (LLM выдумала цитату)')
  {
    const chunkText = 'Семейная ипотека без субсидий. Ставка: 6%. Мин ПВ: 20%.'
    const chunks: RetrievedChunk[] = [
      makeChunk({ text: chunkText, source: 'bestseller/sales_tools.docx' }),
    ]
    const result = resolveAnswer('Какая ставка?', chunks, {
      answer:     'Ставка по семейной ипотеке — 6%.',
      usedChunks: [{ id: 1, fragment: 'Совершенно выдуманная фраза, которой нет в этом документе вообще' }],
    })
    check('citations: [] (invalid fragment отброшен, без safeExcerpt-заглушки)', result.citations.length === 0)
    check('answer заменён на стандартный no-answer', result.answer === NO_ANSWER_TEXT, `получено: "${result.answer}"`)
  }
  console.log()

  // ── Тест 3 (контроль): валидный точный fragment ─────────────────────────────
  console.log('Тест 3 (контроль): валидный точный fragment → citation verified')
  {
    const chunkText = 'Семейная ипотека без субсидий. Ставка: 6%. Мин ПВ: 20%.'
    const exactFragment = 'Ставка: 6%. Мин ПВ: 20%.'
    const chunks: RetrievedChunk[] = [
      makeChunk({ text: chunkText, source: 'bestseller/sales_tools.docx' }),
    ]
    const result = resolveAnswer('Какая ставка?', chunks, {
      answer:     'Ставка по семейной ипотеке — 6%.',
      usedChunks: [{ id: 1, fragment: exactFragment }],
    })
    check('answer НЕ изменён', result.answer === 'Ставка по семейной ипотеке — 6%.')
    check('citations содержит 1 запись', result.citations.length === 1)
    check('quote совпадает с fragment', result.citations[0]?.quote === exactFragment)
    check('source из chunk (не от LLM)', result.citations[0]?.source === 'bestseller/sales_tools.docx')
  }
  console.log()

  // ── Тест 4 (контроль): whitespace-tolerant match ────────────────────────────
  console.log('Тест 4 (контроль): fragment с иным whitespace → whitespace-tolerant match')
  {
    // Оригинальный текст с переносом строки (как в реальном XLSX-чанке)
    const chunkText = 'Втузгородок, Кировский район, Комсомольская, 72А \n(на пересечении улиц Библиотечная и Комсомольская)'
    // LLM нормализовала пробелы/перенос при копировании цитаты
    const normalizedFragment = 'Втузгородок, Кировский район, Комсомольская, 72А (на пересечении улиц Библиотечная и Комсомольская)'
    const chunks: RetrievedChunk[] = [
      makeChunk({ text: chunkText, source: 'alisa/knowledge.xlsx', project: 'alisa' }),
    ]
    const result = resolveAnswer('Где находится ЖК Алиса?', chunks, {
      answer:     'ЖК Алиса находится в Втузгородке.',
      usedChunks: [{ id: 1, fragment: normalizedFragment }],
    })
    check('citations содержит 1 запись', result.citations.length === 1)
    const quote = result.citations[0]?.quote ?? ''
    check(
      'quote — ОРИГИНАЛЬНАЯ подстрока chunk.text (с переносом строки, не нормализованная)',
      chunkText.includes(quote) && quote.includes('\n'),
      `quote: ${JSON.stringify(quote)}`,
    )
    check('answer НЕ изменён', result.answer === 'ЖК Алиса находится в Втузгородке.')
  }
  console.log()

  // ── Тест 5 (контроль): malformed JSON от LLM ────────────────────────────────
  console.log('Тест 5 (контроль): malformed / non-JSON content от LLM → no-answer')
  {
    const chunks: RetrievedChunk[] = [
      makeChunk({ text: 'Семейная ипотека без субсидий. Ставка: 6%.', source: 'bestseller/sales_tools.docx' }),
    ]

    // 5a. Обычный текст вместо JSON
    const llmResultA = parseStrictLlmJson('Извините, я не могу ответить в JSON формате.')
    check('5a. malformed content → answer === "" внутри LlmRawAnswer', llmResultA.answer === '')
    check('5a. malformed content → usedChunks: []', llmResultA.usedChunks.length === 0)
    const resultA = resolveAnswer('Какая ставка?', chunks, llmResultA)
    check('5a. финальный answer === NO_ANSWER_TEXT', resultA.answer === NO_ANSWER_TEXT)
    check('5a. citations: []', resultA.citations.length === 0)

    // 5b. Валидный JSON, но без поля "answer" (структура нарушена)
    const llmResultB = parseStrictLlmJson('{"usedChunks": [{"id": 1, "fragment": "Ставка: 6%."}]}')
    check('5b. отсутствует "answer" → весь ответ malformed (usedChunks: [])', llmResultB.usedChunks.length === 0)
    const resultB = resolveAnswer('Какая ставка?', chunks, llmResultB)
    check('5b. финальный answer === NO_ANSWER_TEXT', resultB.answer === NO_ANSWER_TEXT)
  }
  console.log()

  // ── Тест 6: detectProject — русские склонения «Бестселлер» ───────────────────
  console.log('Тест 6: detectProject — Бестселлер / склонения / Bestseller')
  {
    const bestsellerQuestions = [
      'парковка ЖК Бестселлер',
      'парковка в Бестселлере',
      'условия Бестселлера',
      'расскажи про Бестселлер',
      'Bestseller parking',
    ]
    for (const q of bestsellerQuestions) {
      check(`«${q}» → bestseller`, detectProject(q) === 'bestseller')
    }
    check('Алиса → alisa', detectProject('Где находится ЖК Алиса?') === 'alisa')
    check('без проекта → undefined', detectProject('Какая ставка по семейной ипотеке?') === undefined)
    check('оба проекта → undefined', detectProject('Сравни Алису и Бестселлер') === undefined)
  }
  console.log()

  // ── Итог ─────────────────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`  Итог: ${passed} passed, ${failed} failed`)
  console.log('══════════════════════════════════════════════════════════════')

  if (failed > 0) process.exit(1)
}

main()
