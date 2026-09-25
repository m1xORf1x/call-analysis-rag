/**
 * server/utils/sttProvider.ts
 *
 * Общий интерфейс STT-провайдера.
 * Бизнес-логика (scripts/pipeline.ts и т.д.) не должна зависеть от конкретной
 * реализации STT — только от этого интерфейса.
 *
 * Текущие реализации:
 *   - soniox.ts   — Soniox async REST API (основной провайдер)
 *   - voicekit.ts — T-Bank VoiceKit gRPC (резервная/legacy реализация, сохранена как есть)
 *
 * Выбор активного провайдера: env STT_PROVIDER = "soniox" (по умолчанию) | "voicekit"
 */

export interface STTProvider {
  /**
   * Транскрибирует аудио и возвращает читаемый текст.
   * @param audio        Аудиоданные в памяти (Uint8Array); на диск не пишется.
   * @param contentType  MIME-тип аудио (опционально; помогает провайдеру определить формат).
   */
  transcribe(audio: Uint8Array, contentType?: string): Promise<string>
}

import { sonioxProvider } from './soniox'
import { voicekitProvider } from './voicekit'

/**
 * Возвращает активный STT-провайдер согласно env STT_PROVIDER.
 * По умолчанию — Soniox.
 */
export function getSttProvider(): STTProvider {
  const name = (process.env.STT_PROVIDER?.trim() || 'soniox').toLowerCase()

  switch (name) {
    case 'soniox':
      return sonioxProvider
    case 'voicekit':
      return voicekitProvider
    default:
      throw new Error(
        `Unknown STT_PROVIDER: "${name}". Supported values: "soniox", "voicekit".`,
      )
  }
}
