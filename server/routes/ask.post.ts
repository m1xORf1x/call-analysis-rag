/**
 * server/routes/ask.post.ts
 *
 * POST /ask — канонический RAG Q&A endpoint (согласно ТЗ).
 *
 * Реализован как безопасный alias: ре-экспортирует тот же Nitro event handler,
 * что и POST /api/ask (server/api/ask.post.ts). Вся валидация, RAG pipeline
 * и LLM generation сосредоточены там — здесь ничего не дублируется.
 *
 * POST /api/ask остаётся рабочим для обратной совместимости.
 *
 * Оба endpoint принимают и возвращают одинаковый контракт:
 *   Request:  { "question": "..." }
 *   Response: { "answer": "...", "citations": [{ "source": "...", "quote": "..." }] }
 */
export { default } from '../api/ask.post'
