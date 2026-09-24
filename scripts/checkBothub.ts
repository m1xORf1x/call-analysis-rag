/// <reference types="node" />
// Загружаем .env при локальном запуске; не перезаписывает переменные хостинга
import 'dotenv/config'

/**
 * scripts/checkBothub.ts
 *
 * Smoke-тест LLM-анализа через BotHub.
 * Не зависит от VoiceKit, Calls API или SQLite.
 *
 * Что проверяет:
 *   1. Читает синтетический fixture-транскрипт из fixtures/sample-transcript.txt
 *   2. Отправляет его в BotHub LLM через analyseTranscript()
 *   3. Валидирует полученный CallAnalysis
 *   4. Выводит результат в читаемом виде
 *
 * Требует в .env:
 *   BOTHUB_API_KEY, BOTHUB_MODEL
 *
 * Запуск: npm run check-llm
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { analyseTranscript } from '../server/utils/bothub'
import type { CallAnalysis } from '../types/index.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// fixtures/ — корень проекта: scripts/ → ../fixtures/
const FIXTURE_PATH = join(__dirname, '..', 'fixtures', 'sample-transcript.txt')

async function main(): Promise<void> {
  console.log('🤖 BotHub LLM — smoke test\n')

  // ── 1. Загрузить fixture-транскрипт ─────────────────────────────────────────
  process.stdout.write('1. Загрузка fixture-транскрипта... ')
  let transcript: string
  try {
    transcript = await readFile(FIXTURE_PATH, 'utf-8')
  } catch (err) {
    console.error(
      `FAIL\n   Не удалось прочитать ${FIXTURE_PATH}\n   ${err instanceof Error ? err.message : String(err)}`,
    )
    process.exit(1)
  }
  const lineCount = transcript.split('\n').filter(l => l.trim()).length
  console.log(`OK (${lineCount} строк)`)
  console.log()

  // ── 2. LLM-анализ ────────────────────────────────────────────────────────────
  console.log('2. Анализ транскрипта через BotHub LLM...')
  console.log('   (BOTHUB_MODEL:', process.env.BOTHUB_MODEL ?? '⚠ не задан', ')')
  console.log()

  let analysis: CallAnalysis
  try {
    analysis = await analyseTranscript(transcript)
  } catch (err) {
    console.error(
      `\n✗ LLM-анализ провалился:\n   ${err instanceof Error ? err.message : String(err)}`,
    )
    process.exit(1)
  }

  // ── 3. Вывод результата ─────────────────────────────────────────────────────
  console.log('── CallAnalysis ─────────────────────────────────────────────')
  console.log()

  console.log('📋 Резюме:')
  console.log('  ', analysis.summary)
  console.log()

  console.log('✅ Сильные стороны:')
  console.log('  ', analysis.strongPoints)
  console.log()

  console.log('⚠️  Слабые стороны:')
  console.log('  ', analysis.weakPoints)
  console.log()

  console.log('💡 Рекомендация:')
  console.log('  ', analysis.recommendation)
  console.log()

  const { client } = analysis
  const interestEmoji = client.interest === 'high' ? '🔴' : client.interest === 'medium' ? '🟡' : '🟢'
  console.log(`👤 Клиент (интерес: ${interestEmoji} ${client.interest}):`)
  console.log('   Объект:    ', client.object ?? '—')
  console.log('   Бюджет:    ', client.budget ?? '—')

  if (client.objections.length > 0) {
    console.log('   Возражения:')
    for (const obj of client.objections) {
      console.log(`     • ${obj}`)
    }
  } else {
    console.log('   Возражения: —')
  }

  if (client.competitors.length > 0) {
    console.log('   Конкуренты:')
    for (const comp of client.competitors) {
      console.log(`     • ${comp}`)
    }
  } else {
    console.log('   Конкуренты: —')
  }

  console.log()
  console.log('────────────────────────────────────────────────────────────')
  console.log()

  // ── 4. Проверка наличия ключевых полей в fixture ────────────────────────────
  console.log('3. Проверка ключевых полей (fixture coverage)...')

  const checks: Array<[string, boolean]> = [
    ['interest задан', ['high', 'medium', 'low'].includes(client.interest)],
    ['object не null', client.object !== null],
    ['budget не null', client.budget !== null],
    ['есть хотя бы одно возражение', client.objections.length > 0],
    ['есть хотя бы один конкурент', client.competitors.length > 0],
  ]

  let allPassed = true
  for (const [label, passed] of checks) {
    console.log(`   ${passed ? '✓' : '✗'} ${label}`)
    if (!passed) allPassed = false
  }

  console.log()
  if (!allPassed) {
    console.error(
      '✗ Некоторые поля fixture не извлечены — проверьте системный промпт или fixture-транскрипт.',
    )
    process.exit(1)
  }

  console.log('✅ Все проверки прошли успешно')
}

main().catch(err => {
  console.error('\n✗ Критическая ошибка:', err instanceof Error ? err.message : err)
  process.exit(1)
})
