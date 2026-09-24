// ─── Часть 1: Звонки ────────────────────────────────────────────────────────

/**
 * Запись звонка, возвращаемая внешним Calls API.
 * Контракт: GET {BASE}/v1/calls → { calls: Call[] }
 */
export interface Call {
  id: string
  filename: string
  duration_sec: number
  content_type: string
}

/**
 * Статус обработки звонка внутри нашего пайплайна.
 * pending   — известно из API, ещё не скачано
 * downloaded — аудио получено
 * transcribed — STT выполнен
 * analyzed   — LLM-анализ выполнен, результат сохранён
 * error      — на любом шаге произошла ошибка
 */
export type CallStatus =
  | 'pending'
  | 'downloaded'
  | 'transcribed'
  | 'analyzed'
  | 'error'

/**
 * JSON-анализ звонка, строго по схеме ТЗ.
 * LLM должен возвращать только этот JSON, без Markdown вокруг.
 */
export interface CallAnalysis {
  summary: string
  strongPoints: string
  weakPoints: string
  recommendation: string
  client: {
    interest: 'high' | 'medium' | 'low'
    /** ЖК / лот, если звучал в разговоре; иначе null */
    object: string | null
    /** Сумма, если звучала; иначе null */
    budget: string | null
    /** Возражения клиента короткими фразами */
    objections: string[]
    /** Упомянутые конкурирующие ЖК / застройщики */
    competitors: string[]
  }
}

/**
 * Полная запись звонка, хранимая в нашей БД.
 * Расширяет Call полями пайплайна.
 */
export interface CallRecord extends Call {
  status: CallStatus
  /** Сырой транскрипт от STT; null до шага транскрибации */
  transcript: string | null
  /** Результат LLM-анализа; null до шага анализа */
  analysis: CallAnalysis | null
  /** Сообщение об ошибке, если status === 'error' */
  error: string | null
  created_at: string
  updated_at: string
}

// ─── Часть 2: RAG ───────────────────────────────────────────────────────────

/**
 * Один чанк документа после парсинга и нарезки.
 * Метаданные хранятся рядом с вектором эмбеддинга.
 */
export interface Chunk {
  /** Имя исходного файла (например, "alice-ipoteka.pdf") */
  source: string
  /** Порядковый номер чанка в документе, начиная с 0 */
  chunk_index: number
  /** Текст чанка (ориентир 400–800 токенов) */
  text: string
}

/**
 * Ссылка на источник в ответе RAG-эндпоинта.
 * quote — узнаваемый дословный фрагмент исходного чанка, не пересказ.
 */
export interface Citation {
  source: string
  quote: string
}

/** Тело запроса POST /api/ask */
export interface AskRequest {
  question: string
}

/** Тело ответа POST /api/ask */
export interface AskResponse {
  answer: string
  citations: Citation[]
}
