/**
 * scripts/ingest.ts
 *
 * Часть 2: Инжест документов для RAG
 *
 * Цепочка шагов (будет реализована после получения документов и ключей):
 *   1. scanDocs     — найти все PDF и Markdown в data/docs/
 *   2. parseDoc     — извлечь текст из каждого файла
 *   3. chunkDoc     — нарезать текст на чанки (400–800 токенов, overlap 50–100)
 *   4. embedChunks  — получить векторы эмбеддингов для каждого чанка
 *   5. storeChunks  — сохранить чанки + векторы в локальное хранилище
 *
 * Запускается один раз (или при обновлении документов), не при каждом вопросе.
 * Метаданные чанка: source (имя файла), chunk_index, text.
 *
 * Запуск: npm run ingest
 *
 * Переменные окружения (будут подключены при реализации):
 *   DOCS_PATH    — путь к папке с документами (по умолчанию ./data/docs)
 *   VECTORS_PATH — путь к папке векторного хранилища (по умолчанию ./data/vectors)
 *   EMBEDDINGS_API_KEY — ключ провайдера эмбеддингов
 */

import type { Chunk } from '../types/index.ts'

// ─── Конфигурация ─────────────────────────────────────────────────────────────
// TODO: заменить на process.env.DOCS_PATH и process.env.VECTORS_PATH при реализации

const DOCS_PATH = './data/docs'
const VECTORS_PATH = './data/vectors'

// Ориентировочный размер чанка и перекрытие (в токенах / символах)
const CHUNK_SIZE = 600   // ~400–800 токенов
const CHUNK_OVERLAP = 75 // ~50–100 токенов

// ─── Шаг 1: Сканировать папку с документами ──────────────────────────────────

async function scanDocs(docsPath: string): Promise<string[]> {
  // TODO: реализовать с помощью fs/promises.readdir (рекурсивно)
  // Вернуть полные пути к файлам с расширениями .pdf и .md
  throw new Error(`scanDocs(${docsPath}): не реализовано`)
}

// ─── Шаг 2: Парсинг документа в текст ────────────────────────────────────────

async function parseDoc(filePath: string): Promise<string> {
  // Определяем расширение файла без node:path
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'pdf') {
    // TODO: реализовать через pdf-parse или аналог
    // Только текстовый слой, без изображений
    throw new Error(`parseDoc: парсинг PDF не реализован (${filePath})`)
  }

  if (ext === 'md') {
    // TODO: реализовать чтение Markdown как plain text (или с stripMarkdown)
    throw new Error(`parseDoc: парсинг Markdown не реализован (${filePath})`)
  }

  throw new Error(`parseDoc: неподдерживаемый формат файла: .${ext}`)
}

// ─── Шаг 3: Нарезка текста на чанки ──────────────────────────────────────────

function chunkText(text: string, source: string): Chunk[] {
  // TODO: реализовать нарезку с заданными CHUNK_SIZE и CHUNK_OVERLAP
  // Граница чанка — предпочтительно конец предложения/абзаца
  // Каждый чанк: { source, chunk_index, text }
  throw new Error(`chunkText(${source}): не реализовано`)
}

// ─── Шаг 4: Получить эмбеддинги для чанков ───────────────────────────────────

async function embedChunks(chunks: Chunk[]): Promise<Array<{ chunk: Chunk; vector: number[] }>> {
  // TODO: реализовать через провайдера эмбеддингов (ключ из EMBEDDINGS_API_KEY)
  // Можно батчевать запросы для экономии API-вызовов
  throw new Error(`embedChunks([${chunks.length} chunks]): не реализовано`)
}

// ─── Шаг 5: Сохранить в векторное хранилище ──────────────────────────────────

async function storeChunks(
  items: Array<{ chunk: Chunk; vector: number[] }>,
  vectorsPath: string,
): Promise<void> {
  // TODO: реализовать сохранение в выбранное хранилище (FAISS/Qdrant/Chroma)
  // Метаданные { source, chunk_index, text } должны быть доступны при поиске
  throw new Error(`storeChunks(${items.length} items, ${vectorsPath}): не реализовано`)
}

// ─── Главная функция ──────────────────────────────────────────────────────────

async function runIngest(): Promise<void> {
  console.log('▶ Запуск инжеста документов...')
  console.log(`  Папка документов: ${DOCS_PATH}`)
  console.log(`  Папка векторов:   ${VECTORS_PATH}`)

  // Шаг 1: найти файлы
  const files = await scanDocs(DOCS_PATH)
  console.log(`  Найдено файлов: ${files.length}`)

  if (files.length === 0) {
    console.warn('  ⚠ Нет файлов для инжеста. Положите PDF/Markdown в', DOCS_PATH)
    return
  }

  const allItems: Array<{ chunk: Chunk; vector: number[] }> = []

  // Шаги 2–4: обработать каждый файл
  for (const filePath of files) {
    console.log(`\n── Файл: ${filePath} ──`)

    try {
      // Шаг 2: парсинг
      console.log('  📄 Парсинг...')
      const text = await parseDoc(filePath)

      // Шаг 3: нарезка
      const source = filePath.split('/').pop() ?? filePath
      console.log('  ✂ Нарезка на чанки...')
      const chunks = chunkText(text, source)
      console.log(`  Чанков: ${chunks.length}`)

      // Шаг 4: эмбеддинги
      console.log('  🔢 Эмбеддинги...')
      const embedded = await embedChunks(chunks)
      allItems.push(...embedded)

      console.log('  ✓ Готово')
    } catch (err) {
      // Ошибка одного файла не останавливает инжест
      console.error(`  ✗ Ошибка обработки файла: ${err}`)
    }
  }

  // Шаг 5: сохранить всё в векторное хранилище
  if (allItems.length === 0) {
    throw new Error('Нет чанков для сохранения (все файлы завершились ошибкой?)')
  }

  console.log(`\n  💾 Сохранение ${allItems.length} чанков в векторное хранилище...`)
  await storeChunks(allItems, VECTORS_PATH)
  console.log('✓ Инжест завершён')
}

runIngest()
