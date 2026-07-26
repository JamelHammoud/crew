import type { BoardMentionRef, DesignBoardMeta } from './design'
import type { DocMentionRef, DocPage } from './docs'

export type CrewRefKind = 'doc' | 'board'

export interface CrewRef {
  kind: CrewRefKind
  key: string
  title: string
}

export function crewRefs(docs: Record<string, DocPage>, boards: DesignBoardMeta[]): CrewRef[] {
  const taken = new Set<string>()
  const refs: CrewRef[] = []
  const add = (kind: CrewRefKind, key: string, title: string) => {
    const name = title.trim()
    if (!name || taken.has(name.toLowerCase())) return
    taken.add(name.toLowerCase())
    refs.push({ kind, key, title: name })
  }
  for (const [page, doc] of Object.entries(docs)) add('doc', page, doc.title)
  for (const board of boards) add('board', board.id, board.name)
  return refs
}

export function refCandidates(refs: CrewRef[], query: string | null): CrewRef[] {
  if (query === null) return []
  const q = query.toLowerCase()
  const sorted = [...refs].sort((a, b) => a.title.localeCompare(b.title))
  const prefix = sorted.filter(ref => ref.title.toLowerCase().startsWith(q))
  if (!q) return prefix
  const within = sorted.filter(ref => {
    const title = ref.title.toLowerCase()
    return !title.startsWith(q) && title.includes(q)
  })
  return [...prefix, ...within]
}

export function refsIn(text: string, refs: CrewRef[]): CrewRef[] {
  let work = ` ${text.toLowerCase()} `
  const found: CrewRef[] = []
  const ordered = [...refs].sort((a, b) => b.title.length - a.title.length)
  for (const ref of ordered) {
    const needle = `#${ref.title.toLowerCase()}`
    const at = work.indexOf(needle)
    if (at === -1) continue
    if (/[\w-]/.test(work[at + needle.length])) continue
    found.push(ref)
    work = work.slice(0, at) + ' '.repeat(needle.length) + work.slice(at + needle.length)
  }
  return found
}

export function docMentionsOf(refs: CrewRef[]): DocMentionRef[] {
  return refs.filter(ref => ref.kind === 'doc').map(ref => ({ page: ref.key, title: ref.title }))
}

export function boardMentionsOf(refs: CrewRef[]): BoardMentionRef[] {
  return refs.filter(ref => ref.kind === 'board').map(ref => ({ id: ref.key, name: ref.title }))
}
