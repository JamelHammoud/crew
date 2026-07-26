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

// An agent that is not here cannot take the work, so the ask never offers one.
// Naming it would look like asking and do nothing.
export function agentsHere<T extends { status: string }>(agents: T[]): T[] {
  return agents.filter(agent => agent.status !== 'offline')
}

export function agentToAsk<T extends { id: string; status: string }>(agents: T[], picked: string | null): T | null {
  const here = agentsHere(agents)
  return here.find(agent => agent.id === picked) ?? here[0] ?? null
}

export function askPrompt(label: string, question: string, layers: string[]): string {
  const named = layers.length > 0 ? `\n\nOn this board, change: ${layers.join(', ')}` : ''
  return `@${label} ${question.trim()}${named}`
}
