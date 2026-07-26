const KEY = 'crew.design.agent'

export function lastAskAgent(): string | null {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null
  } catch {
    return null
  }
}

export function rememberAskAgent(agentId: string): void {
  try {
    globalThis.localStorage?.setItem(KEY, agentId)
  } catch {
    return
  }
}

export function askPrompt(label: string, question: string, layers: string[]): string {
  const named = layers.length > 0 ? `\n\nOn this board, change: ${layers.join(', ')}` : ''
  return `@${label} ${question.trim()}${named}`
}
