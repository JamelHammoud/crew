export type CommandName =
  | 'plan'
  | 'tickets'
  | 'goal'
  | 'ghost'
  | 'voice'
  | 'steer'
  | 'queue'
  | 'btw'
  | 'fork'
  | 'fallback'

// Which composer offers a command. The chat's open a thread, so they are asked
// for before there is one. A thread's are about the thread already open: where
// this message lands in it, or that it is not for the thread at all.
export type CommandWhere = 'chat' | 'thread'

export interface SlashCommand {
  name: CommandName
  where: CommandWhere
  hint: string
  // Whether it only means anything while a turn is running.
  live?: boolean
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'plan', where: 'chat', hint: 'Get a plan first, then implement it' },
  { name: 'tickets', where: 'chat', hint: 'Watch the work on a board, and answer as it goes' },
  { name: 'goal', where: 'chat', hint: 'Keep going until the work is done' },
  { name: 'ghost', where: 'chat', hint: 'Nobody else sees this thread' },
  { name: 'voice', where: 'chat', hint: 'Talk to them out loud' },
  { name: 'steer', where: 'thread', hint: 'Go in now, on the turn already running', live: true },
  { name: 'queue', where: 'thread', hint: 'Wait for this turn to finish', live: true },
  { name: 'btw', where: 'thread', hint: 'Ask on the side, without touching the thread' },
  { name: 'fork', where: 'thread', hint: 'Carry on from here in a thread of its own' },
  { name: 'goal', where: 'thread', hint: 'Keep going until the work is done' },
  { name: 'fallback', where: 'thread', hint: 'Name who takes over if this one fails' }
]

const NAMES = [...new Set(SLASH_COMMANDS.map(command => command.name))]

export function commandsIn(where: CommandWhere): SlashCommand[] {
  return SLASH_COMMANDS.filter(command => command.where === where)
}

// Steering and queueing only mean something while there is a turn running that
// this message could go into. Without one every message queues and runs, so
// naming either would promise a choice that was never there.
export function threadCommands(canSteer: boolean): SlashCommand[] {
  return commandsIn('thread').filter(command => canSteer || !command.live)
}

// A command is only a command while it is the whole of what has been typed, so
// the same word inside a sentence is a word. It is lifted onto the composer from
// here and sent beside the message, and nothing ever reads one back out of text.
export function commandTyped(value: string, offered: readonly SlashCommand[]): CommandName | null {
  const match = /^\/(\S+)\s$/.exec(value)
  if (!match) return null
  const typed = match[1].toLowerCase()
  return offered.find(command => command.name === typed)?.name ?? null
}

export function cleanCommands(list: readonly string[] | undefined): CommandName[] {
  const asked = new Set(list ?? [])
  return NAMES.filter(name => asked.has(name))
}

export function slashCandidates(value: string, offered: readonly SlashCommand[]): SlashCommand[] {
  const match = /^\/(\S*)$/.exec(value)
  if (!match) return []
  const query = match[1].toLowerCase()
  return offered.filter(command => command.name.startsWith(query))
}
