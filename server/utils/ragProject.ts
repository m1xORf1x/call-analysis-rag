import type { Project } from '../../types/index'

/** Определяет явно названный в вопросе проект без LLM. */
export function detectProject(question: string): Project | undefined {
  const mentionsAlisa = /(?<![\p{L}\p{N}_])алис(?:а|у|е|ы|ой)(?![\p{L}\p{N}_])/iu.test(question)
  const mentionsBestseller = /(?<![\p{L}\p{N}_])(?:бестселлер(?:а|у|е|ом)?|bestseller)(?![\p{L}\p{N}_])/iu.test(question)

  if (mentionsAlisa === mentionsBestseller) return undefined
  return mentionsAlisa ? 'alisa' : 'bestseller'
}
