export interface SlashCommand {
  name: string
  hint: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'plan', hint: 'Get a plan first, then implement it' },
  { name: 'ghost', hint: 'Nobody else sees this thread' }
]

// A command can sit anywhere in the line, so '@name /plan tidy the readme' and
// '/plan @name tidy the readme' both read the same way.
function read(text: string, name: string): { found: boolean; text: string } {
  const match = new RegExp(`(?:^|\\s)/${name}(?=\\s|$)`, 'i').exec(text)
  if (!match) return { found: false, text }
  const cut = text.slice(0, match.index) + text.slice(match.index + match[0].length)
  return { found: true, text: cut.trim() }
}

export function readCommands(text: string): { planning: boolean; ghost: boolean; text: string } {
  const plan = read(text, 'plan')
  const ghost = read(plan.text, 'ghost')
  return { planning: plan.found, ghost: ghost.found, text: ghost.text }
}

export function slashCandidates(value: string): SlashCommand[] {
  const match = /^\/(\S*)$/.exec(value)
  if (!match) return []
  const query = match[1].toLowerCase()
  return SLASH_COMMANDS.filter(command => command.name.startsWith(query))
}
