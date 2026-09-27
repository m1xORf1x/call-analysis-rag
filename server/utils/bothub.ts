/// <reference types="node" />
/**
 * server/utils/bothub.ts
 *
 * BotHub LLM client — OpenAI-compatible API.
 * Endpoint: https://openai.bothub.chat/v1/chat/completions
 *
 * Правила безопасности:
 *   - BOTHUB_API_KEY читается только из env; никогда не попадает в логи или ошибки.
 *   - BOTHUB_MODEL читается из env; значение по умолчанию в коде не хардкодится.
 */

import type { CallAnalysis } from '../../types/index.ts'

const BOTHUB_BASE_URL = 'https://openai.bothub.chat/v1'

// ─── Системный промпт ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — аналитик звонков отдела продаж недвижимости.

Тебе передаётся транскрипт телефонного разговора между менеджером по продажам и клиентом.

Проанализируй разговор и верни результат СТРОГО в формате JSON — без Markdown, без пояснений, без каких-либо символов до или после JSON.

Структура ответа:
{
  "summary": "<краткое резюме разговора (2–3 предложения)>",
  "strongPoints": "<сильные стороны работы менеджера>",
  "weakPoints": "<слабые стороны и упущения менеджера>",
  "recommendation": "<конкретные рекомендации для улучшения работы менеджера>",
  "client": {
    "interest": "<high | medium | low>",
    "object": "<название ЖК или объекта недвижимости, если упоминался; иначе null>",
    "budget": "<бюджет клиента на покупку, если клиент сам назвал сумму или диапазон; иначе null>",
    "objections": ["<возражение 1>", "<возражение 2>"],
    "competitors": ["<конкурирующий ЖК или застройщик 1>", "<конкурирующий ЖК или застройщик 2>"]
  }
}

Правила:
1. Анализируй только информацию из транскрипта. Не придумывай факты, которых нет в разговоре.
2. Если значение не упоминалось, используй null — не строку «не упоминался» и не пустую строку.
3. Если список пуст, используй [] — пустой массив.
4. Поле "interest" принимает строго одно из трёх значений: "high", "medium", "low".
5. Поле "budget" — ТОЛЬКО сумма или диапазон бюджета, который клиент сам назвал для покупки квартиры. НЕ записывай сюда: обеспечительный взнос, первоначальный взнос, цены квартир от менеджера, суммы ипотеки или брони, если клиент не назвал их как свой бюджет. Если клиент не называл бюджет — null.
6. Поле "competitors" — ТОЛЬКО другие жилые комплексы (ЖК) или застройщики, которых клиент упоминает для сравнения с рассматриваемым объектом. НЕ записывай сюда: риэлторов, агентства, банки, внутренние подразделения, формулировки вроде «внешний риэлтор». Если клиент не сравнивал с другими ЖК/застройщиками — [].
7. Возвращай только JSON. Никакого Markdown, никаких блоков \`\`\`json.`

// ─── OpenAI-совместимые типы ответа ─────────────────────────────────────────

interface ChatMessage {
  role: string
  content: string
}

interface ChatChoice {
  message: ChatMessage
}

interface ChatCompletionResponse {
  choices: ChatChoice[]
}

// ─── Конфигурация ────────────────────────────────────────────────────────────

interface BotHubConfig {
  /** Ключ никогда не включается в логи и сообщения об ошибках */
  apiKey: string
  model: string
}

/**
 * Читает и валидирует env-переменные при каждом вызове.
 * Ленивое чтение позволяет переопределять переменные в тестах.
 */
function getConfig(): BotHubConfig {
  const apiKey = process.env.BOTHUB_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('BOTHUB_API_KEY is not set. Add it to .env or the hosting environment.')
  }

  const model = process.env.BOTHUB_MODEL?.trim()
  if (!model) {
    throw new Error('BOTHUB_MODEL is not set. Add it to .env or the hosting environment.')
  }

  return { apiKey, model }
}

// ─── Препроцессинг ответа ────────────────────────────────────────────────────

/**
 * Убирает опциональные Markdown-блоки (```json ... ``` или ``` ... ```).
 * Защитная мера на случай, если модель игнорирует инструкцию не использовать Markdown.
 * Не исправляет структуру JSON и не добавляет значения по умолчанию.
 */
function stripMarkdownFences(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/)
  return match ? match[1]!.trim() : trimmed
}

/** Клиент явно назвал бюджет / ценовой предел на покупку. */
function clientDeclaredBudget(transcript: string): boolean {
  return /\b(бюджет|рассчитывал.{0,30}(на|примерно)|максимум|могу (себе )?позволить|готов.{0,40}(заплатить|вложить|потратить)|рассматрива.{0,20}до|до \d[\d\s]*(?:млн|миллион|руб|₽)|у меня \d)/i.test(transcript)
}

/** Отсекает типичные ошибки классификации budget / competitors по схеме ТЗ. */
function validateClientSemantics(
  budget: string | null,
  competitors: string[],
  transcript: string,
): void {
  if (budget) {
    const lower = budget.toLowerCase()
    if (lower.includes('обеспечительн') || lower.includes('первоначальн')) {
      throw new Error(
        `BotHub: client.budget должно содержать только заявленный клиентом бюджет на покупку, не взнос (получено: ${JSON.stringify(budget)})`,
      )
    }

    const t = transcript.toLowerCase()
    if (/обеспечительн\s+взнос|залог|бронь/i.test(t) && !clientDeclaredBudget(transcript)) {
      throw new Error(
        `BotHub: client.budget = null — в разговоре обсуждался обеспечительный взнос/бронь, но клиент не назвал бюджет на покупку (получено: ${JSON.stringify(budget)})`,
      )
    }
  }

  for (const name of competitors) {
    const lower = name.toLowerCase()
    if (lower.includes('риэлтор') || lower.includes('риелтор') || lower.includes('агентств')) {
      throw new Error(
        `BotHub: client.competitors — только чужие ЖК/застройщики, не риэлторы (получено: ${JSON.stringify(name)})`,
      )
    }
  }
}

// ─── Валидация ответа LLM ────────────────────────────────────────────────────

/**
 * Строго валидирует распарсенный объект по схеме CallAnalysis.
 * Выбрасывает понятную ошибку при любом несоответствии — без молчаливых исправлений.
 *
 * @param data       Уже распарсенный JSON.
 * @param rawContent Исходный текст ответа модели — используется в сообщениях об ошибке.
 */
function validateCallAnalysis(data: unknown, rawContent: string, transcript: string): CallAnalysis {
  const preview = rawContent.slice(0, 300)

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error(
      `BotHub: ответ модели не является объектом JSON. Начало ответа: ${preview}`,
    )
  }

  const d = data as Record<string, unknown>

  /** Проверяет, что поле существует и является строкой. */
  function requireString(field: string): string {
    const val = d[field]
    if (typeof val !== 'string') {
      throw new Error(
        `BotHub: поле "${field}" отсутствует или не является строкой (получено: ${JSON.stringify(val)})`,
      )
    }
    return val
  }

  const summary = requireString('summary')
  const strongPoints = requireString('strongPoints')
  const weakPoints = requireString('weakPoints')
  const recommendation = requireString('recommendation')

  // ── client ──────────────────────────────────────────────────────────────────
  const clientRaw = d['client']
  if (typeof clientRaw !== 'object' || clientRaw === null || Array.isArray(clientRaw)) {
    throw new Error(
      `BotHub: поле "client" отсутствует или не является объектом (получено: ${JSON.stringify(clientRaw)})`,
    )
  }

  const client = clientRaw as Record<string, unknown>

  // interest
  const interest = client['interest']
  if (interest !== 'high' && interest !== 'medium' && interest !== 'low') {
    throw new Error(
      `BotHub: client.interest должно быть "high", "medium" или "low" (получено: ${JSON.stringify(interest)})`,
    )
  }

  // object
  const object = client['object']
  if (object !== null && typeof object !== 'string') {
    throw new Error(
      `BotHub: client.object должно быть строкой или null (получено: ${JSON.stringify(object)})`,
    )
  }

  // budget
  const budget = client['budget']
  if (budget !== null && typeof budget !== 'string') {
    throw new Error(
      `BotHub: client.budget должно быть строкой или null (получено: ${JSON.stringify(budget)})`,
    )
  }

  // objections
  const objections = client['objections']
  if (!Array.isArray(objections) || !objections.every(x => typeof x === 'string')) {
    throw new Error(
      `BotHub: client.objections должно быть string[] (получено: ${JSON.stringify(objections)})`,
    )
  }

  // competitors
  const competitors = client['competitors']
  if (!Array.isArray(competitors) || !competitors.every(x => typeof x === 'string')) {
    throw new Error(
      `BotHub: client.competitors должно быть string[] (получено: ${JSON.stringify(competitors)})`,
    )
  }

  validateClientSemantics(budget as string | null, competitors as string[], transcript)

  return {
    summary,
    strongPoints,
    weakPoints,
    recommendation,
    client: {
      interest,
      object: object as string | null,
      budget: budget as string | null,
      objections: objections as string[],
      competitors: competitors as string[],
    },
  }
}

// ─── Публичный API ───────────────────────────────────────────────────────────

/**
 * Анализирует транскрипт звонка через BotHub LLM и возвращает структурированный CallAnalysis.
 *
 * Поток:
 *   1. Читает BOTHUB_API_KEY и BOTHUB_MODEL из env.
 *   2. POST /chat/completions с системным промптом + транскрипт в user-сообщении.
 *   3. Извлекает content из choices[0].message.
 *   4. Убирает опциональные Markdown-обёртки.
 *   5. Парсит JSON.
 *   6. Строго валидирует структуру по CallAnalysis.
 *   7. Возвращает валидный CallAnalysis или выбрасывает понятную ошибку.
 *
 * @throws ошибку с описанием проблемы; API key никогда не включается в сообщение.
 */
export async function analyseTranscript(transcript: string): Promise<CallAnalysis> {
  const { apiKey, model } = getConfig()

  // ── 1. HTTP-запрос ──────────────────────────────────────────────────────────
  let res: Response
  try {
    res = await fetch(`${BOTHUB_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: transcript },
        ],
        temperature: 0,
      }),
    })
  } catch (err) {
    throw new Error(
      `BotHub: сетевая ошибка — ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!res.ok) {
    throw new Error(`BotHub: HTTP ${res.status} ${res.statusText}`)
  }

  // ── 2. Парсинг HTTP-тела ────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new Error('BotHub: тело ответа не является валидным JSON')
  }

  // ── 3. Извлечение content из ответа OpenAI-совместимого формата ────────────
  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as ChatCompletionResponse).choices) ||
    (body as ChatCompletionResponse).choices.length === 0
  ) {
    throw new Error('BotHub: неожиданная структура ответа (нет поля choices)')
  }

  const choice = (body as ChatCompletionResponse).choices[0]!
  const rawContent = choice.message?.content

  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw new Error('BotHub: пустой или отсутствующий content в ответе модели')
  }

  // ── 4. Предобработка: убрать Markdown-блоки если есть ──────────────────────
  const cleaned = stripMarkdownFences(rawContent)

  // ── 5. Парсинг JSON из ответа модели ───────────────────────────────────────
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(
      `BotHub: модель вернула невалидный JSON. Начало ответа: ${rawContent.slice(0, 300)}`,
    )
  }

  // ── 6. Строгая валидация по схеме CallAnalysis ──────────────────────────────
  return validateCallAnalysis(parsed, rawContent, transcript)
}
