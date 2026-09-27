/**
 * Минимальная декларация типов для пакета mammoth (нет @types/mammoth).
 * Покрывает только используемую в проекте функцию extractRawText().
 */
declare module 'mammoth' {
  interface Message {
    type: 'warning' | 'error'
    message: string
  }
  interface ExtractRawTextResult {
    value: string
    messages: Message[]
  }
  interface PathInput {
    path: string
  }
  function extractRawText(input: PathInput): Promise<ExtractRawTextResult>
}
