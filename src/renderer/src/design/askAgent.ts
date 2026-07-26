const KEY = 'crew.design.agent'

// The agent behind the ask bar's orb is a choice you make once, so the same
// face is waiting on every board and in every window.
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
