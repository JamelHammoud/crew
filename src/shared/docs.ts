export interface DocPage {
  title: string
  text: string
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/
const CODED_SEGMENT = /^(.*)-(\d[a-z0-9]{3})$/

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
  const words = page.split('/').pop()!.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function pageCode(): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
  let code = alphabet[Math.floor(Math.random() * 10)]
  for (let i = 0; i < 3; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
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
