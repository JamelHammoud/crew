export interface DocPage {
  title: string
  text: string
}

export interface DocRef {
  page: string
  title: string
}

export interface DocMentionRef {
  page: string
  title: string
}

export function docRefs(docs: Record<string, DocPage>): DocRef[] {
  return Object.entries(docs)
    .map(([page, doc]) => ({ page, title: doc.title }))
    .filter(ref => ref.title.trim().length > 0)
}

export function docCandidates(docs: Record<string, DocPage>, query: string | null): DocRef[] {
  if (query === null) return []
  const q = query.toLowerCase()
  const refs = docRefs(docs).sort((a, b) => a.title.localeCompare(b.title))
  const prefix = refs.filter(ref => ref.title.toLowerCase().startsWith(q))
  if (!q) return prefix
  const within = refs.filter(ref => {
    const title = ref.title.toLowerCase()
    return !title.startsWith(q) && title.includes(q)
  })
  return [...prefix, ...within]
}

export function docMentionsIn(text: string, docs: Record<string, DocPage>): string[] {
  let work = ` ${text.toLowerCase()} `
  const pages: string[] = []
  const ordered = docRefs(docs).sort((a, b) => b.title.length - a.title.length)
  for (const ref of ordered) {
    const needle = `#${ref.title.toLowerCase()}`
    const at = work.indexOf(needle)
    if (at === -1) continue
    if (/[\w-]/.test(work[at + needle.length])) continue
    pages.push(ref.page)
    work = work.slice(0, at) + ' '.repeat(needle.length) + work.slice(at + needle.length)
  }
  return pages
}

export function docMentionRefsIn(text: string, docs: Record<string, DocPage>): DocMentionRef[] {
  return docMentionsIn(text, docs).map(page => ({ page, title: docs[page].title }))
}

export function pageCodeOf(page: string): string | null {
  return splitPageCode(page.split('/').pop()!).code
}

export function resolveDocRef(docs: Record<string, DocPage>, ref: DocMentionRef): string | null {
  if (docs[ref.page] !== undefined) return ref.page
  const code = pageCodeOf(ref.page)
  if (!code) return null
  return Object.keys(docs).find(page => pageCodeOf(page) === code) ?? null
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/
const CODED_SEGMENT = /^(.*)-(\d(?=[a-z0-9]*[a-z])[a-z0-9]{3})$/

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

export function fallbackTitle(page: string): string {
  const words = splitPageCode(page.split('/').pop()!).base.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function pageCode(): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
  let code = alphabet[Math.floor(Math.random() * 10)]
  for (let i = 0; i < 3; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return /[a-z]/.test(code) ? code : pageCode()
}

export function splitPageCode(segment: string): { base: string; code: string | null } {
  const match = CODED_SEGMENT.exec(segment)
  return match ? { base: match[1], code: match[2] } : { base: segment, code: null }
}

export function pageSlug(parent: string, base: string, code: string): string {
  return `${parent ? `${parent}/` : ''}${base}-${code}`
}

export function parseDocFile(raw: string, page: string): DocPage {
  const match = FRONTMATTER.exec(raw)
  if (match) {
    const line = match[1].split('\n').find(l => l.startsWith('title:'))
    if (line) {
      const value = line.slice('title:'.length).trim()
      const title = value.startsWith('"') ? parseQuoted(value) : value
      return { title, text: raw.slice(match[0].length).replace(/^\n/, '') }
    }
  }
  return { title: fallbackTitle(page), text: raw }
}

export function serializeDocFile(doc: DocPage): string {
  return `---\ntitle: ${JSON.stringify(doc.title)}\n---\n\n${doc.text}`
}

function parseQuoted(value: string): string {
  try {
    return JSON.parse(value)
  } catch {
    return value.replace(/^"|"$/g, '')
  }
}
