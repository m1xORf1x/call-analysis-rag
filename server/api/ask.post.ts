/**
 * server/api/ask.post.ts
 *
 * POST /api/ask — RAG Q&A endpoint.
 *
 * Request body (JSON):
 *   { "question": "Какая ипотека в ЖК Алиса?" }
 *
 * Response 200:
 *   { "answer": "...", "citations": [{ "source": "...", "quote": "..." }] }
 *
 * Response 400 — невалидный запрос (question отсутствует / не строка / пустой).
 * Response 500 — сбой внешнего API (Qdrant / BotHub); credentials не раскрываются.
 *
 * Внутренние поля (usedChunks, score, Qdrant metadata) наружу не передаются.
 * Вся логика retrieval + LLM сосредоточена в answerQuestion(); endpoint — тонкая обёртка.
 */

import { answerQuestion } from '../utils/ragAnswer'
import type { AskRequest, AskResponse } from '../../types/index'

export default defineEventHandler(async (event): Promise<AskResponse> => {
  // ── 1. Чтение тела запроса ──────────────────────────────────────────────────
  let body: unknown
  try {
    body = await readBody(event)
  } catch {
    throw createError({
      statusCode:    400,
      statusMessage: 'Invalid request body: expected JSON',
    })
  }

  // ── 2. Валидация ────────────────────────────────────────────────────────────

  if (typeof body !== 'object' || body === null) {
    throw createError({
      statusCode:    400,
      statusMessage: 'Request body must be a JSON object',
    })
  }

  const { question } = body as Partial<AskRequest>

  if (typeof question !== 'string') {
    throw createError({
      statusCode:    400,
      statusMessage: 'question must be a string',
    })
  }

  const trimmedQuestion = question.trim()
  if (!trimmedQuestion) {
    throw createError({
      statusCode:    400,
      statusMessage: 'question must not be empty',
    })
  }

  // ── 3. Pipeline: retrieval → LLM → citations ───────────────────────────────
  try {
    const result = await answerQuestion(trimmedQuestion)

    // Возвращаем только публичный контракт; score, chunkIndex и пр. не раскрываем
    return {
      answer:    result.answer,
      citations: result.citations,
    }
  } catch (err) {
    // Безопасное логирование: только message, без stack, без credentials
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error(`[POST /api/ask] answerQuestion failed: ${msg}`)

    throw createError({
      statusCode:    500,
      statusMessage: 'Internal server error',
    })
  }
})
