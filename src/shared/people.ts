export interface MentionableMember {
  id: string
  name: string
  connected: boolean
}

export interface MemberMentionRef {
  id: string
  name: string
}

export function memberMentionCandidates<T extends MentionableMember>(members: T[], query: string | null): T[] {
  if (query === null) return []
  const q = query.toLowerCase()
  const connected = members.filter(member => member.connected)
  const prefix = connected.filter(member => member.name.toLowerCase().startsWith(q))
  if (!q || q.includes(' ')) return prefix
  const within = connected.filter(member => {
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
