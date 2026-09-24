/// <reference types="node" />
// Загружаем .env при локальном запуске; не перезаписывает переменные хостинга
import 'dotenv/config'

/**
 * scripts/checkCallsApi.ts
 *
 * Минимальный smoke-тест интеграции с Calls API.
 * Не зависит от STT, LLM, БД — проверяет только сетевой слой.
 *
 * Что проверяет:
 *   1. Health check  — /v1/health отвечает { ok: true }
 *   2. Список звонков — /v1/calls возвращает валидный массив Call[]
 *   3. Скачивание аудио — /v1/calls/{id}/audio возвращает непустые байты
 *      (только для первого звонка; на диск не пишется)
 *
 * Требует: CALLS_API_BASE_URL и CALLS_API_TOKEN в .env или окружении.
 *
 * Запуск: npm run check-api
 */

import { checkHealth, fetchCalls, downloadAudio } from '../server/utils/callsApi'

async function main(): Promise<void> {
  console.log('🔍 Calls API — smoke test\n')

  // ── 1. Health ──────────────────────────────────────────────────────────────
  process.stdout.write('1. Health check... ')
  const healthy = await checkHealth()
  if (!healthy) {
    console.error(
      'FAIL\n   API недоступен или вернул { ok: false }.\n' +
        '   Проверьте CALLS_API_BASE_URL и доступность сервера.',
    )
    process.exit(1)
  }
  console.log('OK')

  // ── 2. Список звонков ──────────────────────────────────────────────────────
  process.stdout.write('2. Список звонков... ')
  const calls = await fetchCalls()
  console.log(`OK (${calls.length} шт.)`)

  for (const c of calls) {
    console.log(`     • ${c.id}  ${c.filename}  ${c.duration_sec}s  ${c.content_type}`)
  }

  if (calls.length === 0) {
    console.warn('\n   ⚠ Список пуст — нечего скачивать. Проверки пройдены.')
    return
  }

  // ── 3. Скачивание первого аудио ────────────────────────────────────────────
  const first = calls[0]!
  process.stdout.write(`3. Скачивание ${first.id} (${first.filename})... `)
  const audio = await downloadAudio(first)
  console.log(`OK — ${audio.byteLength.toLocaleString()} байт`)
  // Аудио не сохраняется на диск; Uint8Array уходит в GC

  console.log('\n✅ Все проверки прошли успешно')
}

main().catch(err => {
  console.error('\n✗ Проверка провалилась:', err instanceof Error ? err.message : err)
  process.exit(1)
})
