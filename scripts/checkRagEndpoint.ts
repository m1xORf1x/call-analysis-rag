/// <reference types="node" />
import 'dotenv/config'
/**
 * scripts/checkRagEndpoint.ts
 *
 * Diagnostic/integration check для POST /api/ask endpoint.
 *
 * Тестирует полный контракт endpoint-а без запуска Nuxt-сервера:
 * зеркалирует логику валидации + вызывает answerQuestion() напрямую.
 * Это гарантирует, что тот же код, что стоит за HTTP-хендлером, работает корректно.
 *
 * Проверяет:
 *   1. Вопрос без проекта сохраняет общий поиск.
 *   2. Бестселлер / Алиса ограничивают citations своим project.
 *   3. Вопрос без информации (off-topic) → 200, честный ответ, citations: [].
 *   4. Невалидные question → 400.
 *
 * Запуск: npm run rag:endpoint:check
 */

import { answerQuestion } from '../server/utils/ragAnswer'
import { detectProject } from '../server/utils/ragProject'
import { ensurePayloadIndexes } from '../server/utils/ragStore'
import type { AskRequest, AskResponse } from '../types/index'

// ─── Зеркало логики endpoint-а ───────────────────────────────────────────────
// Воспроизводит ту же последовательность валидации и вызова, что в ask.post.ts.
// Используется вместо реального HTTP-запроса, чтобы не требовать запущенного Nuxt.

interface SimulatedResponse {
  status:  number
  body:    AskResponse | { error: string }
}

async function simulateEndpoint(rawBody: unknown): Promise<SimulatedResponse> {
  // Шаг 1: тело — объект
  if (typeof rawBody !== 'object' || rawBody === null) {
    return { status: 400, body: { error: 'Request body must be a JSON object' } }
  }

  const { question } = rawBody as Partial<AskRequest>

  // Шаг 2: question — строка
  if (typeof question !== 'string') {
    return { status: 400, body: { error: 'question must be a string' } }
  }

  // Шаг 3: question не пустой после trim
  const trimmed = question.trim()
  if (!trimmed) {
    return { status: 400, body: { error: 'question must not be empty' } }
  }

  // Шаг 4: вызов pipeline
  try {
    const project = detectProject(trimmed)
    const result = await answerQuestion(trimmed, { project })
    return {
      status: 200,
      body:   { answer: result.answer, citations: result.citations },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error(`  [simulateEndpoint] answerQuestion failed: ${msg}`)
    return { status: 500, body: { error: 'Internal server error' } }
  }
}

// ─── Тестовые кейсы ──────────────────────────────────────────────────────────

interface TestCase {
  label:       string
  body:        unknown
  expectStatus: number
  /** Если задана — answer должен содержать эту строку (case-insensitive) */
  expectAnswerContains?: string
  /** Если true — citations должны быть непустым массивом */
  expectCitations?: boolean
  /** Если задан — все citations должны принадлежать этому project */
  expectCitationPrefix?: string
}

const TEST_CASES: TestCase[] = [
  {
    label:            '1. Вопрос без названия проекта сохраняет общий поиск',
    body:             { question: 'Какая ставка по семейной ипотеке?' } as AskRequest,
    expectStatus:     200,
    expectCitations:  true,
  },
  {
    label:            '2. Явный Бестселлер фильтрует citations',
    body:             { question: 'Расскажи про парковку ЖК Бестселлер' } as AskRequest,
    expectStatus:     200,
    expectCitations:  true,
    expectCitationPrefix: 'bestseller/',
  },
  {
    label:            '3. Явная Алиса фильтрует citations',
    body:             { question: 'Где находится ЖК Алиса?' } as AskRequest,
    expectStatus:     200,
    expectCitations:  true,
    expectCitationPrefix: 'alisa/',
  },
  {
    label:            '4. Вопрос без информации (off-topic)',
    body:             { question: 'Какой курс доллара?' } as AskRequest,
    expectStatus:     200,
    expectAnswerContains: 'нет',
    expectCitations:  false,
  },
  {
    label:            '5. Пустой question (trim → "")',
    body:             { question: '   ' } as AskRequest,
    expectStatus:     400,
  },
  {
    label:            '6. Отсутствующий question field',
    body:             {} as AskRequest,
    expectStatus:     400,
  },
  {
    label:            '7. question — не строка (число)',
    body:             { question: 42 },
    expectStatus:     400,
  },
]

// ─── Утилиты вывода ──────────────────────────────────────────────────────────

const SEP  = '══════════════════════════════════════════════════════════════'
const SEP2 = '──────────────────────────────────────────────────────────────'

function statusBadge(actual: number, expected: number): string {
  return actual === expected ? `HTTP ${actual} ✓` : `HTTP ${actual} ✗ (ожидался ${expected})`
}

function checkFailed(msg: string): never {
  console.error(`\n  ✗ FAIL: ${msg}`)
  process.exit(1)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║    RAG Endpoint Check — POST /api/ask contract              ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log('  Endpoint:  POST /api/ask')
  console.log('  Метод:     Simulated (зеркало логики endpoint-а)')
  console.log(`  Кейсов:    ${TEST_CASES.length}`)
  console.log()

  // Payload indexes (нужны для project-filter в Qdrant)
  process.stdout.write('  Payload indexes… ')
  await ensurePayloadIndexes()
  console.log('OK\n')

  let totalPassed = 0
  let totalFailed = 0

  for (const tc of TEST_CASES) {
    console.log(SEP)
    console.log(`  ${tc.label}`)
    console.log(SEP2)

    // Показываем request body
    console.log(`  Request body: ${JSON.stringify(tc.body)}`)
    console.log()

    const response = await simulateEndpoint(tc.body)

    console.log(`  Status: ${statusBadge(response.status, tc.expectStatus)}`)

    // ── Проверки для 2xx ──────────────────────────────────────────────────────
    if (tc.expectStatus === 200) {
      if (response.status !== 200) {
        totalFailed++
        console.log(`  Body:   ${JSON.stringify(response.body)}`)
        console.log()
        continue
      }

      const body = response.body as AskResponse

      // answer: строка
      if (typeof body.answer !== 'string') {
        checkFailed(`answer должен быть строкой, получено: ${typeof body.answer}`)
      }

      // citations: массив
      if (!Array.isArray(body.citations)) {
        checkFailed(`citations должен быть массивом, получено: ${typeof body.citations}`)
      }

      // каждый citation: { source: string, quote: string }
      for (const c of body.citations) {
        if (typeof c.source !== 'string' || typeof c.quote !== 'string') {
          checkFailed(`Citation должен содержать source и quote (строки): ${JSON.stringify(c)}`)
        }
      }

      // expectAnswerContains
      if (tc.expectAnswerContains) {
        if (!body.answer.toLowerCase().includes(tc.expectAnswerContains.toLowerCase())) {
          checkFailed(`answer должен содержать «${tc.expectAnswerContains}», получено: «${body.answer.slice(0, 120)}»`)
        }
        console.log(`  Answer contains «${tc.expectAnswerContains}» ✓`)
      }

      // expectCitations
      if (tc.expectCitations === true && body.citations.length === 0) {
        checkFailed('Ожидались citations, получен пустой массив')
      }
      if (tc.expectCitations === false && body.citations.length > 0) {
        checkFailed(`Для off-topic ожидались citations: [], получено: ${body.citations.length} элементов`)
      }
      if (
        tc.expectCitationPrefix &&
        body.citations.some(c => !c.source.startsWith(tc.expectCitationPrefix!))
      ) {
        checkFailed(
          `Все citations должны начинаться с «${tc.expectCitationPrefix}», получено: ${body.citations.map(c => c.source).join(', ')}`,
        )
      }

      // Вывод ответа
      console.log()
      console.log('  Response body (contract fields only):')
      console.log(`    answer:    «${body.answer.slice(0, 150)}${body.answer.length > 150 ? '…' : ''}»`)
      if (body.citations.length > 0) {
        console.log(`    citations: ${body.citations.length} шт.`)
        for (let i = 0; i < body.citations.length; i++) {
          const c = body.citations[i]!
          console.log(`      [${i + 1}] ${c.source}`)
          console.log(`           «${c.quote.slice(0, 100)}${c.quote.length > 100 ? '…' : ''}»`)
        }
      } else {
        console.log('    citations: []')
      }

      totalPassed++

    // ── Проверки для 4xx ──────────────────────────────────────────────────────
    } else if (tc.expectStatus === 400) {
      if (response.status !== 400) {
        totalFailed++
        console.log(`  Body: ${JSON.stringify(response.body)}`)
        console.log()
        continue
      }

      const body = response.body as { error: string }
      if (typeof body.error !== 'string' || !body.error) {
        checkFailed('400-ответ должен содержать поле error (string)')
      }

      console.log(`  Error: «${body.error}»`)
      totalPassed++
    }

    console.log()
  }

  // ── Итог ─────────────────────────────────────────────────────────────────────
  console.log(SEP)
  console.log(`  Результат: ${totalPassed}/${TEST_CASES.length} прошли`)
  console.log()

  if (totalFailed > 0) {
    console.error(`  ✗ ${totalFailed} кейс(ов) провалились`)
    process.exit(1)
  }

  console.log('  ✓ Все кейсы прошли успешно')
  console.log()
  console.log('  Route:     POST /api/ask')
  console.log('  File:      server/api/ask.post.ts')
  console.log()
  console.log('  Примеры запросов:')
  console.log('    curl -X POST http://localhost:3000/api/ask \\')
  console.log('      -H "Content-Type: application/json" \\')
  console.log('      -d \'{"question": "Какая ставка по семейной ипотеке?"}\'')
  console.log(SEP)
}

main().catch(err => {
  console.error('\n✗ Неожиданная ошибка:', err instanceof Error ? err.message : err)
  process.exit(1)
})
