export const ROOT_PAGE = 'main'
export const ROOT_TITLE = 'Genesis'

export interface DocPage {
  title: string
  text: string
}

export interface DocMentionRef {
  page: string
  title: string
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
  if (page === ROOT_PAGE) return ROOT_TITLE
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

const FENCE = /^\s*(```|~~~)/

export function docExcerpt(text: string, limit = 240): string {
  const kept: string[] = []
  let length = 0
  for (const line of text.trim().split('\n')) {
    if (kept.length > 0 && length + line.length + 1 > limit) break
    kept.push(kept.length === 0 ? clip(line, limit) : line)
    length += line.length + 1
  }
  let open: string | null = null
  for (const line of kept) {
    const match = FENCE.exec(line)
    if (!match) continue
    if (open === null) open = match[1]
    else if (line.trim().startsWith(open)) open = null
  }
  if (open) kept.push(open)
  return kept.join('\n').trim()
}

function clip(line: string, limit: number): string {
  if (line.length <= limit) return line
  const cut = line.slice(0, limit)
  const space = cut.lastIndexOf(' ')
  return `${space > limit / 2 ? cut.slice(0, space) : cut}…`
}

function parseQuoted(value: string): string {
  try {
    return JSON.parse(value)
  } catch {
    return value.replace(/^"|"$/g, '')
  }
}
