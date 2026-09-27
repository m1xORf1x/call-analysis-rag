/// <reference types="node" />
import 'dotenv/config'
/**
 * scripts/checkRagEmbed.ts
 *
 * Smoke test для embedding API (Stage 3 RAG).
 * Отправляет одну тестовую строку и выводит только:
 *   - success / failure
 *   - имя модели из ответа
 *   - размерность вектора
 *   - количество входных элементов
 *
 * НЕ выводит API key и НЕ выводит вектор.
 *
 * Запуск: npm run rag:embed:check
 */

import { embedTexts } from '../server/utils/ragEmbed'

const TEST_INPUT = 'Тестовая строка для проверки embedding API. ЖК Алиса, Бестселлер.'

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║           RAG Embed Check — embedding API smoke test         ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`  Модель:    ${process.env.EMBEDDINGS_MODEL ?? '(не задана — будет ошибка)'}`)
  console.log(`  Base URL:  ${process.env.EMBEDDINGS_BASE_URL ?? 'https://openai.bothub.chat/v1 (default)'}`)
  console.log(`  API key:   ${process.env.EMBEDDINGS_API_KEY ? '*** (задан)' : '(не задан — будет ошибка)'}`)
  console.log(`  Тест:      «${TEST_INPUT}»`)
  console.log()

  let result
  try {
    result = await embedTexts([TEST_INPUT])
  } catch (err) {
    console.log('  ✗ FAILURE')
    console.log(`  Ошибка: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  console.log('  ✓ SUCCESS')
  console.log()
  console.log(`  Модель из ответа:   ${result.model}`)
  console.log(`  Размерность вектора: ${result.dimensions}`)
  console.log(`  Входных элементов:  ${result.inputCount}`)
}

main().catch(err => {
  console.error('\n✗ Неожиданная ошибка:', err instanceof Error ? err.message : err)
  process.exit(1)
})
