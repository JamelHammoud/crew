// Who is writing right now. It is never written down: it rides in memory on the
// host and in `typing.room`, the way a call does, so a morning of half finished
// sentences is not something the crew scrolls past later.
export interface Typist {
  id: string
  name: string
  // Which composer they are writing in: a thread's id, a board's id, or absent
  // for the chat itself.
  where?: string
}

// How long the host believes a typist without hearing from them again. A window
// that dies mid-word would otherwise type forever.
export const TYPING_TTL = 6000

// How often a window says it is still writing. Well inside the ttl, so a slow
// message never blinks out between two of them.
export const TYPING_PING = 2000

export const typistsIn = (typists: Typist[], where: string | undefined, selfId: string): Typist[] =>
  typists.filter(typist => typist.id !== selfId && (typist.where ?? '') === (where ?? ''))

export function typingLine(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`
  return `${names[0]} and ${names.length - 1} others are typing`
}
