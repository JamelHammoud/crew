export interface MentionableMember {
  id: string
  name: string
  connected: boolean
}

export interface MemberMentionRef {
  id: string
  name: string
}

export const MEMBER_NAME_LIMIT = 40

export function cleanMemberName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MEMBER_NAME_LIMIT)
}

// A message carries the name of whoever wrote it rather than their id, and the
// host keys people by name too, so a face is matched the same way.
export function memberPhoto(members: Array<{ name: string; avatar?: string }>, name: string): string | undefined {
  const key = name.trim().toLowerCase()
  return members.find(member => member.name.trim().toLowerCase() === key)?.avatar
}

// Everyone in the crew, here or not. An agent that is away cannot do the work,
// so naming one is a message to nobody and it is left out; a person reads theirs
// when they come back, which is the whole point of naming them. Whoever is here
// stands first and the dot on the face says which is which, so the list needs no
// heading over either half.
export function memberMentionCandidates<T extends MentionableMember>(members: T[], query: string | null): T[] {
  if (query === null) return []
  const q = query.toLowerCase()
  const people = [...members].sort((a, b) => Number(b.connected) - Number(a.connected))
  const prefix = people.filter(member => member.name.toLowerCase().startsWith(q))
  if (!q || q.includes(' ')) return prefix
  const within = people.filter(member => {
    const name = member.name.toLowerCase()
    return !name.startsWith(q) && name.includes(q)
  })
  return [...prefix, ...within]
}

export function memberMentionRefsIn(
  text: string,
  members: Array<Pick<MentionableMember, 'id' | 'name'>>
): MemberMentionRef[] {
  let work = ` ${text.toLowerCase()} `
  const refs: MemberMentionRef[] = []
  const ordered = [...members].sort((a, b) => b.name.length - a.name.length)
  for (const member of ordered) {
    const needle = `@${member.name.toLowerCase()}`
    const at = work.indexOf(needle)
    if (at === -1) continue
    if (/[\w-]/.test(work[at + needle.length])) continue
    refs.push({ id: member.id, name: member.name })
    work = work.slice(0, at) + ' '.repeat(needle.length) + work.slice(at + needle.length)
  }
  return refs
}
