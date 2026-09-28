/**
 * server/utils/ragAnswer.ts
 *
 * Part 2 RAG — Stage 5: LLM generation + citations.
 *
 * Pipeline:
 *   question → retrieveChunks() → build numbered context → BotHub chat completion
 *   → strict JSON parse {answer, usedChunks[{id, fragment}]} → validate fragments
 *   → resolveAnswer() → Citation[] или стандартный no-answer
 *
 * Strict generation contract (без similarity threshold):
 *   • BotHub response СТРОГО парсится как ожидаемый JSON. Malformed/non-JSON
 *     ответ никогда не возвращается пользователю как обычный answer —
 *     он превращается в usedChunks: [] и, как следствие, в no-answer.
 *   • usedChunks — массив ожидаемой структуры {id: number, fragment: string};
 *     любые прочие элементы отфильтровываются.
 *   • Содержательный answer без хотя бы одной VERIFIED citation запрещён:
 *     если после валидации fragments не осталось ни одной подтверждённой
 *     citation — весь ответ заменяется на стандартный NO_ANSWER_TEXT.
 *
 * Гарантии против галлюцинаций citations (два уровня, БЕЗ unsafe fallback):
 *   • source    — берётся из метаданных Qdrant (RetrievedChunk.source); LLM не участвует.
 *   • id        — LLM указывает номер чанка 1..N; если выходит за границы — игнорируется.
 *   • fragment  — LLM предлагает дословную цитату; backend проверяет:
 *       1. Точное совпадение chunk.text.includes(fragment) → quote = fragment.
 *       2. Whitespace-tolerant match → quote = исходная подстрока chunk.text.
 *     Если ни один уровень не подтвердил fragment — citation считается INVALID
 *     и отбрасывается. НЕТ fallback на safeExcerpt/весь chunk: LLM не может
 *     получить citation только потому, что указала существующий chunk id.
 *
 * Не содержит HTTP-слой и UI: POST /api/ask реализован в server/api/ask.post.ts,
 * POST /ask — alias в server/routes/ask.post.ts.
 */

import type { Citation, AnswerResult, Project } from '../../types/index'
import { retrieveChunks } from './ragRetrieve'
import type { RetrievedChunk } from '../../types/index'
import { withRetry } from './ragRetry'

// ─── Конфигурация ─────────────────────────────────────────────────────────────

const BOTHUB_BASE_URL  = 'https://openai.bothub.chat/v1'
const DEFAULT_TOP_K    = 5
/**
 * Минимальная длина fragment от LLM, ниже которой он считается бессмысленным
 * и не может подтвердить citation (даже при точном substring-совпадении).
 */
const MIN_FRAGMENT_LENGTH = 20

/**
 * Стандартный ответ при отсутствии информации — используется в трёх случаях:
 *   1. retrieval вернул пустой список chunks;
 *   2. LLM-ответ не прошёл строгий JSON-парсинг (malformed/non-JSON);
 *   3. после валидации fragments не осталось ни одной VERIFIED citation
 *      (в том числе когда LLM сама вернула usedChunks: [] при содержательном answer).
 */
export const NO_ANSWER_TEXT = 'Информации по данному вопросу в предоставленных материалах нет.'

interface LlmConfig { apiKey: string; model: string }

function getConfig(): LlmConfig {
  const apiKey = process.env.BOTHUB_API_KEY?.trim()
  if (!apiKey) throw new Error('BOTHUB_API_KEY is not set')
  const model = process.env.BOTHUB_MODEL?.trim()
  if (!model)  throw new Error('BOTHUB_MODEL is not set')
  return { apiKey, model }
}

// ─── Промпт ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — ассистент по продажам недвижимости BAZA Development.

Тебе предоставляются пронумерованные фрагменты документов и вопрос клиента.

Правила:
1. Отвечай ТОЛЬКО на основании предоставленных фрагментов. Не используй внешние знания.
2. Не придумывай факты, цифры, условия или характеристики.
3. Если ответ на вопрос не содержится ни в одном фрагменте — ответь честно:
   «Информации по данному вопросу в предоставленных материалах нет.»
4. Каждый конкретный факт, цифра или условие в ответе должны быть подтверждены
   дословным fragment из текста. Если для какого-то факта нет дословной подстроки —
   не включай этот факт в ответ.

Формат ответа — строго JSON, без Markdown-обёрток:
{
  "answer": "<ответ на русском языке>",
  "usedChunks": [
    { "id": <номер фрагмента 1..N>, "fragment": "<дословная цитата 60–150 символов из текста фрагмента>" }
  ]
}

Правила для usedChunks:
- Для каждого отдельного факта, цифры или условия в ответе добавь ОТДЕЛЬНУЮ запись.
  Пример: если в ответе упомянуты три разные ставки — нужны три записи с разными fragment.
- Из одного фрагмента [N] разрешается несколько записей, если они подтверждают разные факты.
- "id" — целый номер от 1 до N (из пронумерованного контекста).
- "fragment" — СКОПИРУЙ ДОСЛОВНО ту часть текста фрагмента, которая подтверждает конкретный факт.
  Это должна быть буквальная подстрока исходного текста — без изменений, парафраза или пересказа.
  Длина: 60–150 символов.
- Если ни один фрагмент не помог — верни "usedChunks": [].`

// ─── Вспомогательные функции ──────────────────────────────────────────────────

/** Человекочитаемое описание местоположения чанка для контекста LLM */
function chunkLocation(c: RetrievedChunk): string {
  if (c.pageStart !== undefined) {
    return c.pageEnd !== undefined && c.pageEnd !== c.pageStart
      ? `стр. ${c.pageStart}–${c.pageEnd}`
      : `стр. ${c.pageStart}`
  }
  if (c.slideStart !== undefined) {
    return c.slideEnd !== undefined && c.slideEnd !== c.slideStart
      ? `слайды ${c.slideStart}–${c.slideEnd}`
      : `слайд ${c.slideStart}`
  }
  if (c.sheet !== undefined) return `лист «${c.sheet}»`
  return ''
}

/** Строит нумерованный контекст для user-сообщения */
function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const loc = chunkLocation(c)
      const header = loc ? `[${i + 1}] Источник: ${c.source} | ${loc}` : `[${i + 1}] Источник: ${c.source}`
      return `${header}\n${c.text.trim()}`
    })
    .join('\n\n')
}

// ─── Whitespace-tolerant fragment validation ──────────────────────────────────
//
// Проблема: XLSX/PDF часто содержат нестандартные пробелы (табы, double-space,
// \r\n), и LLM при копировании цитаты нормализует их к одиночному пробелу.
// Строгий includes() ломается — корректная цитата не проходит проверку.
//
// Решение: двухэтапный поиск.
//   1. Точное совпадение (includes) — если прошло, возвращаем fragment as-is.
//   2. Whitespace-tolerant match:
//      a. Строим отображение нормализованный_индекс → диапазон в оригинале.
//      b. Ищем нормализованный fragment в нормализованном chunkText.
//      c. Если найдено — возвращаем ИСХОДНУЮ подстроку из chunkText с
//         оригинальными пробелами/переносами (не нормализованный вариант).
//   Если ничего не нашли — fragment невалиден. НЕТ safeExcerpt fallback:
//   citation в этом случае просто не создаётся.
//
// Fuzzy matching слов, исправление опечаток или смысловое совпадение — запрещены.
// Допускается только различие в whitespace.

/** Заменяет любые последовательности пробельных символов на одиночный пробел. */
function normalizeWS(s: string): string {
  return s.replace(/\s+/g, ' ')
}

/**
 * Строит отображение: каждый символ нормализованной строки → исходный диапазон.
 *
 * Алгоритм: идём по original; последовательность whitespace-символов схлопывается
 * в один пробел в normalized, остальные символы копируются 1:1.
 *
 * origStarts[i] — начало оригинального диапазона i-го нормализованного символа.
 * origEnds[i]   — конец (exclusive) оригинального диапазона.
 */
function buildNormMapping(original: string): {
  normalized: string
  origStarts: number[]
  origEnds:   number[]
} {
  let normalized = ''
  const origStarts: number[] = []
  const origEnds:   number[] = []
  let i = 0

  while (i < original.length) {
    if (/\s/.test(original[i]!)) {
      const start = i
      while (i < original.length && /\s/.test(original[i]!)) i++
      normalized += ' '
      origStarts.push(start)
      origEnds.push(i)
    } else {
      normalized += original[i]!
      origStarts.push(i)
      origEnds.push(i + 1)
      i++
    }
  }

  return { normalized, origStarts, origEnds }
}

/**
 * Ищет fragment в chunkText с допуском на whitespace.
 *
 * @returns Исходная подстрока chunkText с оригинальными пробелами — или null.
 */
function findWhitespaceTolerant(chunkText: string, fragment: string): string | null {
  const normFrag = normalizeWS(fragment).trim()
  if (normFrag.length < MIN_FRAGMENT_LENGTH) return null

  const { normalized, origStarts, origEnds } = buildNormMapping(chunkText)

  const idx = normalized.indexOf(normFrag)
  if (idx === -1) return null

  const endIdx = idx + normFrag.length - 1
  // Защита от выхода за границы (не должно происходить при корректном mapping)
  if (idx >= origStarts.length || endIdx >= origEnds.length) return null

  return chunkText.slice(origStarts[idx]!, origEnds[endIdx]!)
}

/**
 * Проверяет и извлекает quote для citation — ДВА уровня, без unsafe fallback:
 *   1. Точное совпадение (includes) → fragment как есть.
 *   2. Whitespace-tolerant match   → исходная подстрока chunkText.
 * Если оба уровня не сработали — fragment невалиден (null); вызывающий код
 * должен ОТБРОСИТЬ citation целиком, а не подставлять safeExcerpt/весь chunk.
 */
function verifyFragment(chunkText: string, fragment: string): string | null {
  if (fragment.length >= MIN_FRAGMENT_LENGTH && chunkText.includes(fragment)) {
    return fragment
  }
  return findWhitespaceTolerant(chunkText, fragment)
}

// ─── OpenAI-совместимые типы ──────────────────────────────────────────────────

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>
}

/** Удаляет опциональные ```json ... ``` обёртки */
function stripMarkdownFences(text: string): string {
  const trimmed = text.trim()
  const m = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/)
  return m ? m[1]!.trim() : trimmed
}

// ─── LLM-запрос ───────────────────────────────────────────────────────────────

/**
 * Один элемент usedChunks из ответа LLM.
 * id — 1-based номер чанка из пронумерованного контекста.
 * fragment — предложенная LLM дословная цитата (будет верифицирована backend-ом).
 */
export interface UsedChunkEntry {
  id:       number
  fragment: string
}

/**
 * Строго типизированный результат парсинга ответа LLM.
 * answer === '' означает «ответ не прошёл строгий JSON-контракт»
 * (malformed JSON, не-объект, или отсутствующее/невалидное поле "answer").
 * В этом случае usedChunks гарантированно пуст.
 */
export interface LlmRawAnswer {
  answer:     string
  usedChunks: UsedChunkEntry[]
}

async function fetchLlmRawContent(
  userMessage: string,
  config: LlmConfig,
): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${BOTHUB_BASE_URL}/chat/completions`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model:       config.model,
        messages:    [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userMessage },
        ],
        temperature: 0,
      }),
    })
  } catch (err) {
    throw new Error(`ragAnswer: сетевая ошибка — ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!res.ok) {
    throw new Error(`ragAnswer: HTTP ${res.status} ${res.statusText}`)
  }

  let body: unknown
  try { body = await res.json() } catch {
    throw new Error('ragAnswer: тело ответа не является валидным JSON')
  }

  const choices = (body as ChatCompletionResponse).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('ragAnswer: неожиданная структура ответа LLM (нет choices)')
  }

  const rawContent = choices[0]!.message?.content
  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw new Error('ragAnswer: пустой content в ответе LLM')
  }

  return rawContent
}

async function callLlm(
  userMessage: string,
  config: LlmConfig,
): Promise<LlmRawAnswer> {
  const rawContent = await withRetry(
    () => fetchLlmRawContent(userMessage, config),
    { label: 'RAG' },
  )

  return parseStrictLlmJson(rawContent)
}

/**
 * Строго парсит content ответа LLM по ожидаемому JSON-контракту.
 *
 * Правило: если content не является валидным JSON-объектом с полем
 * "answer" (string), результат считается malformed. Malformed-ответ
 * НИКОГДА не возвращается пользователю как обычный answer — вместо
 * этого возвращается { answer: '', usedChunks: [] }, что дальше в
 * resolveAnswer() гарантированно приводит к NO_ANSWER_TEXT (т.к.
 * usedChunks: [] → citations: [] → answer заменяется).
 *
 * Экспортирована отдельно от callLlm(), чтобы быть тестируемой без
 * реального HTTP-вызова (см. scripts/checkRagAnswerContract.ts).
 */
export function parseStrictLlmJson(rawContent: string): LlmRawAnswer {
  const MALFORMED: LlmRawAnswer = { answer: '', usedChunks: [] }

  const cleaned = stripMarkdownFences(rawContent)
  let parsed: unknown
  try { parsed = JSON.parse(cleaned) } catch {
    return MALFORMED
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return MALFORMED
  }

  const p = parsed as Record<string, unknown>

  // Строгий контракт: "answer" обязателен и должен быть строкой.
  // Без этого весь ответ считается malformed — сырой JSON/текст никогда
  // не подставляется в answer вместо явного отказа.
  if (typeof p['answer'] !== 'string') {
    return MALFORMED
  }
  const answer = p['answer']

  // usedChunks: массив объектов {id, fragment}; любые невалидные элементы
  // (не объект, отсутствует id/fragment, неверный тип) отфильтровываются —
  // это и есть проверка «ожидаемой структуры».
  const usedChunks: UsedChunkEntry[] = []
  if (Array.isArray(p['usedChunks'])) {
    for (const entry of p['usedChunks'] as unknown[]) {
      if (
        typeof entry === 'object' && entry !== null &&
        typeof (entry as Record<string, unknown>)['id'] === 'number' &&
        Number.isInteger((entry as Record<string, unknown>)['id']) &&
        typeof (entry as Record<string, unknown>)['fragment'] === 'string'
      ) {
        usedChunks.push({
          id:       (entry as Record<string, unknown>)['id'] as number,
          fragment: ((entry as Record<string, unknown>)['fragment'] as string).trim(),
        })
      }
    }
  }

  return { answer, usedChunks }
}

// ─── Построение финального AnswerResult ───────────────────────────────────────

/**
 * Строит финальный AnswerResult из retrieved chunks + результата LLM.
 *
 * Инкапсулирует всю citation-валидацию и strict no-answer override —
 * вынесена отдельно от callLlm()/answerQuestion(), чтобы быть тестируемой
 * с mock LLM-результатом без реального HTTP-вызова.
 *
 * Правила (strict generation contract):
 *   • Для каждого entry в usedChunks: id должен быть в [1..N], иначе entry
 *     игнорируется.
 *   • Дедупликация по паре (id, fragment): точные дубликаты отбрасываются,
 *     но один и тот же chunk id может появляться несколько раз с РАЗНЫМИ
 *     fragments — это позволяет LLM подтверждать несколько отдельных фактов
 *     из одного chunk (например, несколько ставок из одного документа).
 *   • fragment проверяется verifyFragment() (exact ИЛИ whitespace-tolerant).
 *     Не подтвердился → citation ОТБРАСЫВАЕТСЯ (без fallback).
 *   • Если после этого citations пуст — ЛЮБОЙ answer (даже содержательный)
 *     заменяется на NO_ANSWER_TEXT. Это закрывает три сценария:
 *       - malformed JSON от LLM (usedChunks всегда [])
 *       - LLM вернула содержательный answer, но usedChunks: []
 *       - LLM указала id, но fragment не прошёл валидацию (invalid citation)
 */
export function resolveAnswer(
  question: string,
  chunks: RetrievedChunk[],
  llmResult: LlmRawAnswer,
): AnswerResult {
  // Деду по (id, fragment) — не по одному id: один chunk может подтверждать
  // несколько отдельных фактов, каждый своим fragment.
  const seenPairs = new Set<string>()
  const citations: Citation[] = []

  for (const entry of llmResult.usedChunks) {
    const { id, fragment } = entry

    if (id < 1 || id > chunks.length) continue
    const pairKey = `${id}:${fragment}`
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)

    const chunk = chunks[id - 1]!
    const quote = verifyFragment(chunk.text, fragment)
    if (quote === null) continue // invalid citation — отбрасываем, без fallback

    citations.push({ source: chunk.source, quote })
  }

  if (citations.length === 0) {
    return { question, answer: NO_ANSWER_TEXT, citations: [] }
  }

  return { question, answer: llmResult.answer, citations }
}

// ─── Публичный API ────────────────────────────────────────────────────────────

export interface AnswerOptions {
  topK?:    number
  project?: Project
}

/**
 * Основная точка входа для RAG Q&A.
 *
 * Поток:
 *   1. retrieveChunks() — semantic search в Qdrant. Пусто → NO_ANSWER_TEXT.
 *   2. Строим нумерованный контекст [1]..[N] из найденных чанков.
 *   3. Вызываем BotHub LLM с системным промптом + контекст + вопрос.
 *   4. callLlm() строго парсит ответ по JSON-контракту (parseStrictLlmJson).
 *   5. resolveAnswer() валидирует citations и применяет strict no-answer override.
 *      source и quote НИКОГДА не генерируются LLM напрямую.
 *
 * @throws Если retrieval или сетевой вызов LLM недоступны (не malformed-ответ —
 *         это отдельно обрабатывается внутри callLlm без исключения).
 */
export async function answerQuestion(
  question: string,
  options?: AnswerOptions,
): Promise<AnswerResult> {
  const topK    = options?.topK ?? DEFAULT_TOP_K
  const project = options?.project

  // 1. Retrieval
  const chunks = await retrieveChunks(question, { topK, project })

  // 2. Если чанков нет — возвращаем честный ответ без LLM
  if (chunks.length === 0) {
    return { question, answer: NO_ANSWER_TEXT, citations: [] }
  }

  // 3. Строим контекст и user-сообщение
  const context     = buildContext(chunks)
  const userMessage = `Контекст:\n\n${context}\n\nВопрос: ${question}`

  // 4. LLM (строго парсится внутри callLlm)
  const config    = getConfig()
  const llmResult = await callLlm(userMessage, config)

  // 5. Citation validation + strict no-answer override
  return resolveAnswer(question, chunks, llmResult)
}
