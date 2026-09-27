/**
 * server/utils/ragRetrieve.ts
 *
 * Часть 2 RAG — Этап 4: semantic retrieval.
 *
 * Поток:
 *   question → embedTexts() → Qdrant similarity search → RetrievedChunk[]
 *
 * Текст chunks возвращается как есть из Qdrant payload, без переписывания.
 * Без жёсткого similarity threshold — пороги будут определены после анализа данных.
 */

import { embedTexts } from './ragEmbed'
import { searchPoints } from './ragStore'
import type { RetrievedChunk, Project } from '../../types/index'

// ─── Публичные опции ─────────────────────────────────────────────────────────

export interface RetrieveOptions {
  /** Число возвращаемых chunks (default: 5) */
  topK?: number
  /** Опциональный фильтр по проекту; если не указан — поиск по всей базе */
  project?: Project
}

// ─── Реализация ───────────────────────────────────────────────────────────────

/**
 * Возвращает top-K семантически релевантных chunks для заданного вопроса.
 *
 * Порядок: от наиболее до наименее релевантного (по cosine score).
 * Без фильтрации по score — все K результатов возвращаются вызывающей стороне;
 * threshold применяется на уровне выше (при генерации ответа LLM).
 *
 * @throws  Если embedding API или Qdrant недоступны.
 */
export async function retrieveChunks(
  question: string,
  options?: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const topK = options?.topK ?? 5
  const project = options?.project

  // 1. Embed вопроса
  const embedResult = await embedTexts([question])
  const queryVector = embedResult.vectors[0]
  if (!queryVector) throw new Error('ragRetrieve: не удалось получить вектор вопроса')

  // 2. Поиск в Qdrant
  const rawPoints = await searchPoints(queryVector, topK, project)

  // 3. Преобразование payload → RetrievedChunk
  return rawPoints.map(point => {
    const p = point.payload

    return {
      score:       point.score,
      text:        String(p['text'] ?? ''),
      source:      String(p['source'] ?? ''),
      project:     (p['project'] as Project) ?? 'alisa',
      chunkIndex:  Number(p['chunk_index'] ?? p['chunkIndex'] ?? 0),
      ...(p['pageStart']  !== undefined && { pageStart:  Number(p['pageStart'])  }),
      ...(p['pageEnd']    !== undefined && { pageEnd:    Number(p['pageEnd'])    }),
      ...(p['slideStart'] !== undefined && { slideStart: Number(p['slideStart']) }),
      ...(p['slideEnd']   !== undefined && { slideEnd:   Number(p['slideEnd'])   }),
      ...(p['sheet']      !== undefined && { sheet:      String(p['sheet'])      }),
    }
  })
}
