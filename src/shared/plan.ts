export interface SlashCommand {
  name: string
  hint: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'plan', hint: 'Get a plan first, then implement it' }
]

const PLAN_TOKEN = /(?:^|\s)\/plan(?=\s|$)/i

// '/plan' can sit anywhere in the line, so '@name /plan tidy the readme' and
// '/plan @name tidy the readme' both read the same way.
export function readPlanCommand(text: string): { planning: boolean; text: string } {
  const match = PLAN_TOKEN.exec(text)
  if (!match) return { planning: false, text }
  const cut = text.slice(0, match.index) + text.slice(match.index + match[0].length)
  return { planning: true, text: cut.trim() }
}

export function slashCandidates(value: string): SlashCommand[] {
  const match = /^\/(\S*)$/.exec(value)
  if (!match) return []
  const query = match[1].toLowerCase()
  return SLASH_COMMANDS.filter(command => command.name.startsWith(query))
}

export const PLAN_INSTRUCTIONS = [
  'This thread is in plan mode. Read whatever you need to, then write the plan and stop there.',
  'Do not create, edit, or delete files, and do not run anything that changes the project.',
  'Reply with the plan itself: what you would change, file by file, in the order you would do it.',
  'Someone reads it next and presses Implement plan when they want the work done.'
].join(' ')

export const IMPLEMENT_PROMPT = 'Implement the plan.'
