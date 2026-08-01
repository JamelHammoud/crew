export interface CrewMemory {
  id: string
  text: string
  by: string
  byAgentId?: string
  ts: number
}

export const MEMORY_TEXT_LIMIT = 240
export const MEMORY_LIMIT = 60
export const MEMORY_ADD_LIMIT = 8

export const MEMORY_FULL = `The crew has as many memories as it can hold. Take one out before adding another.`

export const cleanMemoryLine = (raw: unknown): string =>
  typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MEMORY_TEXT_LIMIT) : ''

export const memoryKey = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim()

export function cleanMemoryLines(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  const lines: string[] = []
  const keys = new Set<string>()
  for (const entry of list) {
    const line = cleanMemoryLine(typeof entry === 'string' ? entry : (entry as { text?: unknown })?.text)
    const key = memoryKey(line)
    if (line && !keys.has(key)) {
      keys.add(key)
      lines.push(line)
    }
    if (lines.length >= MEMORY_ADD_LIMIT) break
  }
  return lines
}

const draw = (width: number): string => {
  let out = ''
  while (out.length < width) out += Math.floor(Math.random() * 16).toString(16)
  return out
}

export function shortId(taken: ReadonlySet<string> = new Set()): string {
  for (let width = 6; ; width++) {
    for (let tries = 0; tries < 20; tries++) {
      const id = draw(width)
      if (!taken.has(id)) return id
    }
  }
}

export function memoryPreamble(apiBase: string, promptId: string, memories: readonly CrewMemory[] = []): string {
  const held = memories.slice(0, MEMORY_LIMIT)
  const shown = held.length
    ? held.map(one => `  ${one.id}  ${one.text}`)
    : ['  Nothing yet. You would be the first to write one down.']
  return [
    `## What this crew has learned`,
    ``,
    `Every agent here reads the same list, so what you write down is what the next one knows before it starts.`,
    ``,
    ...shown,
    ``,
    `Write one down when you learn something that will still be true next week: how something is run here, a decision and why it went the way it did, a thing that bit you and would bite whoever comes next.`,
    ``,
    `  curl -s -X POST ${apiBase}/memory -H 'content-type: application/json' -d '{"promptId":"${promptId}","memories":["The tests boot real servers, so run one suite at a time"]}'`,
    ``,
    `Rewrite one when it stops being true.`,
    ``,
    `  curl -s -X POST ${apiBase}/memory/4f2a1c -H 'content-type: application/json' -d '{"promptId":"${promptId}","text":"The tests boot real servers on loopback, so run one suite at a time"}'`,
    ``,
    `Take one out when it is wrong.`,
    ``,
    `  curl -s -X POST ${apiBase}/memory/4f2a1c/forget -H 'content-type: application/json' -d '{"promptId":"${promptId}"}'`,
    ``,
    `The list is already above, so nothing has to be asked for. Read it again after a helper comes back.`,
    ``,
    `  curl -s '${apiBase}/memory?promptId=${promptId}'`,
    ``,
    `Keep each one to a sentence. Never write down what the project already says, what only happened in this thread, or anything about a person they have not said themselves. Everyone in the crew reads these and they stay.`
  ].join('\n')
}
