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

/** Проект / клиент, к которому принадлежит документ. */
export type Project = 'alisa' | 'bestseller'

/**
 * Документ после парсинга, до нарезки на чанки.
 * Одна запись = одна логическая единица исходного файла
 * (страница PDF, слайд PPTX, лист XLSX, или весь DOCX).
 */
export interface SourceDocument {
  /** Имя файла без пути, например "presentation.pdf" */
  source: string
  /** Проект, к которому относится документ */
  project: Project
  /** Извлечённый текстовый контент */
  text: string
  /** Номер страницы PDF (1-based); undefined для других форматов */
  page?: number
  /** Номер слайда PPTX (1-based); undefined для других форматов */
  slide?: number
  /** Имя листа XLSX; undefined для других форматов */
  sheet?: string
}

/**
 * Чанк документа после нарезки, готовый к embedding.
 *
 * source    — уникальный идентификатор в формате "project/filename",
 *             например "alisa/presentation.pdf". Включает project,
 *             чтобы файлы с одинаковым basename не конфликтовали.
 * chunkIndex — сквозной 0-based счётчик внутри source; стабилен и
 *              детерминирован при одинаковом входе.
 *
 * Диапазоны страниц / слайдов:
 *   pageStart / pageEnd   — первая и последняя страница PDF в чанке.
 *   slideStart / slideEnd — первый и последний слайд PPTX в чанке.
 *   Если чанк состоит из одной единицы, Start === End.
 */
export interface DocumentChunk {
  /** "project/filename", например "alisa/presentation.pdf" */
  source: string
  /** Проект, к которому относится документ */
  project: Project
  /** Порядковый номер чанка внутри source (0-based) */
  chunkIndex: number
  /** Текст чанка (ориентир 400–800 токенов) */
  text: string
  /** Первая страница PDF в чанке (1-based) */
  pageStart?: number
  /** Последняя страница PDF в чанке (1-based) */
  pageEnd?: number
  /** Первый слайд PPTX в чанке (1-based) */
  slideStart?: number
  /** Последний слайд PPTX в чанке (1-based) */
  slideEnd?: number
  /** Имя листа XLSX */
  sheet?: string
}

/**
 * Ссылка на источник в ответе RAG-эндпоинта.
 * quote — узнаваемый дословный фрагмент исходного чанка, не пересказ.
 */
export interface Citation {
  source: string
  quote: string
}

/**
 * Один chunk, возвращённый semantic search из Qdrant.
 * Текст — исходный, не переписанный.
 */
export interface RetrievedChunk {
  /** Косинусное сходство (0–1 для Cosine с нормализованными векторами) */
  score: number
  /** Исходный текст chunk без изменений */
  text: string
  /** "project/filename", например "alisa/presentation.pdf" */
  source: string
  project: Project
  chunkIndex: number
  pageStart?: number
  pageEnd?: number
  slideStart?: number
  slideEnd?: number
  sheet?: string
}

/**
 * Результат функции answerQuestion():
 * вопрос + ответ LLM + citations из реальных Qdrant-чанков.
 */
export interface AnswerResult {
  question: string
  answer: string
  citations: Citation[]
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
