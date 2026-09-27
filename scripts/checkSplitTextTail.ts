/// <reference types="node" />
/**
 * scripts/checkSplitTextTail.ts
 *
 * Регрессионный тест для splitText() tail bug:
 * после push последнего chunk (когда end === src.length) цикл не должен
 * создавать ещё одну, отдельную итерацию — chunk-«хвост», состоящий
 * только из overlap-области предыдущего chunk (дубликат его конца).
 *
 * Запуск: npm run rag:splittext:check
 */

import { splitText } from '../server/utils/ragChunk'

let passed = 0
let failed = 0

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

function main(): void {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║     splitText tail bug — regression test                    ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()

  // Длинный синтетический текст: 60 пронумерованных предложений
  const sentences: string[] = []
  for (let i = 1; i <= 60; i++) {
    sentences.push(`Это предложение номер ${i} в длинном тексте для проверки нарезки.`)
  }
  const longText = sentences.join(' ')
  console.log(`  Длина текста: ${longText.length} символов`)
  console.log()

  const maxChars     = 300
  const overlapChars = 60

  const chunks = splitText(longText, maxChars, overlapChars)
  console.log(`  Chunks: ${chunks.length}`)
  console.log()

  check('Создано больше одного chunk (текст длиннее maxChars)', chunks.length > 1)

  // Главная проверка бага: ни один chunk не должен быть полностью
  // содержащейся подстрокой предыдущего chunk — это симптом лишнего
  // overlap-хвоста (chunk[i+1] был просто концом chunk[i]).
  let noDuplicateTail = true
  for (let i = 0; i < chunks.length - 1; i++) {
    if (chunks[i]!.includes(chunks[i + 1]!)) {
      noDuplicateTail = false
      console.log(`    ✗ chunk[${i + 1}] полностью содержится внутри chunk[${i}] — дублирующийся хвост!`)
      console.log(`      chunk[${i + 1}] = "${chunks[i + 1]}"`)
    }
  }
  check('Нет chunk, дублирующего overlap-хвост предыдущего', noDuplicateTail)

  // Последний chunk должен доходить ровно до конца исходного текста
  const src = longText.trim()
  const lastChunk = chunks[chunks.length - 1]!
  check(
    'Последний chunk доходит до конца исходного текста',
    src.endsWith(lastChunk),
    `lastChunk (конец): "...${lastChunk.slice(-50)}"`,
  )

  // Все chunks не превышают maxChars
  const allWithinLimit = chunks.every(c => c.length <= maxChars)
  check('Все chunks ≤ maxChars', allWithinLimit)

  // Второй регрессионный кейс: текст короче maxChars — один chunk, без хвоста
  const shortText = 'Короткий текст, который не требует нарезки вообще.'
  const shortChunks = splitText(shortText, maxChars, overlapChars)
  check('Короткий текст → ровно 1 chunk (без лишних итераций)', shortChunks.length === 1)

  console.log()
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`  Итог: ${passed} passed, ${failed} failed`)
  console.log('══════════════════════════════════════════════════════════════')

  if (failed > 0) process.exit(1)
}

main()
