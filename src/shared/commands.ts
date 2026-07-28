export type CommandName = 'plan' | 'ghost' | 'voice'

export interface SlashCommand {
  name: CommandName
  hint: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'plan', hint: 'Get a plan first, then implement it' },
  { name: 'ghost', hint: 'Nobody else sees this thread' },
  { name: 'voice', hint: 'Talk to them out loud' }
]

const NAMES = SLASH_COMMANDS.map(command => command.name)

// A command is only a command while it is the whole of what has been typed, so
// the same word inside a sentence is a word. It is lifted onto the composer from
// here and sent beside the message, and nothing ever reads one back out of text.
export function commandTyped(value: string): CommandName | null {
  const match = /^\/(\S+)\s$/.exec(value)
  if (!match) return null
  const typed = match[1].toLowerCase()
  return NAMES.find(name => name === typed) ?? null
}

export function cleanCommands(list: readonly string[] | undefined): CommandName[] {
  const asked = new Set(list ?? [])
  return NAMES.filter(name => asked.has(name))
}

export function slashCandidates(value: string): SlashCommand[] {
  const match = /^\/(\S*)$/.exec(value)
  if (!match) return []
  const query = match[1].toLowerCase()
  return SLASH_COMMANDS.filter(command => command.name.startsWith(query))
}
