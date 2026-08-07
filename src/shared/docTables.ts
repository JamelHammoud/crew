export const WIDTHS_MARK = 'crew:cols'

const WIDTHS = /^<!--\s*crew:cols\s(.*)-->\s*$/
const FENCE = /^(```|~~~)/

export interface DocTableBlock {
  type?: string
  content?: unknown
  children?: DocTableBlock[]
}

export function readDocTableWidths(markdown: string): { text: string; widths: (number | null)[][] } {
  const lines = markdown.split('\n')
  const kept: string[] = []
  const marks: { at: number; widths: (number | null)[] }[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = WIDTHS.exec(lines[i].trim())
    if (!match) {
      kept.push(lines[i])
      continue
    }
    marks.push({ at: kept.length, widths: parseWidths(match[1]) })
    if (lines[i + 1]?.trim() === '') i++
  }
  const starts = tableStarts(kept)
  const widths: (number | null)[][] = starts.map(() => [])
  for (const mark of marks) {
    const index = starts.findIndex(start => start >= mark.at)
    if (index >= 0) widths[index] = mark.widths
  }
  return { text: kept.join('\n'), widths }
}

export function writeDocTableWidths(markdown: string, widths: (number | null)[][]): string {
  const lines = readDocTableWidths(markdown).text.split('\n')
  const starts = tableStarts(lines)
  const out: string[] = []
  let next = 0
  for (let i = 0; i < lines.length; i++) {
    if (starts[next] === i) {
      const line = widthsLine(widths[next])
      if (line) out.push(line, '')
      next++
    }
    out.push(lines[i])
  }
  return out.join('\n')
}

export function tableWidthsOf(blocks: DocTableBlock[]): (number | null)[][] {
  const widths: (number | null)[][] = []
  walk(blocks, block => widths.push(columnWidths(block).map(width => (usable(width) ? Math.round(width) : null))))
  return widths
}

export function applyTableWidths(blocks: DocTableBlock[], widths: (number | null)[][]): DocTableBlock[] {
  let index = 0
  walk(blocks, block => {
    const row = widths[index++]
    if (!row?.some(usable)) return
    const content = block.content as { columnWidths?: (number | null)[] }
    content.columnWidths = columnWidths(block).map((width, column) => (usable(row[column]) ? row[column] : (width ?? null)))
  })
  return blocks
}

function walk(blocks: DocTableBlock[], each: (block: DocTableBlock) => void): void {
  for (const block of blocks) {
    if (block.type === 'table' && block.content) each(block)
    if (block.children?.length) walk(block.children, each)
  }
}

function columnWidths(block: DocTableBlock): (number | null)[] {
  const content = block.content as { columnWidths?: (number | null)[]; rows?: { cells?: unknown[] }[] }
  const columns = content.rows?.[0]?.cells?.length ?? 0
  const held = content.columnWidths ?? []
  return Array.from({ length: Math.max(columns, held.length) }, (_, column) => held[column] ?? null)
}

function widthsLine(widths: (number | null)[] | undefined): string | null {
  if (!widths?.some(usable)) return null
  return `<!-- ${WIDTHS_MARK} ${widths.map(width => (usable(width) ? String(Math.round(width)) : '-')).join(' ')} -->`
}

function parseWidths(raw: string): (number | null)[] {
  return raw
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => {
      const value = Number(word)
      return Number.isFinite(value) && value > 0 ? Math.round(value) : null
    })
}

function usable(width: number | null | undefined): width is number {
  return typeof width === 'number' && Number.isFinite(width) && width > 0
}

function tableStarts(lines: string[]): number[] {
  const starts: number[] = []
  let fence: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    const open = FENCE.exec(trimmed)
    if (fence) {
      if (open && trimmed.startsWith(fence)) fence = null
      continue
    }
    if (open) {
      fence = open[1]
      continue
    }
    if (trimmed.startsWith('|') && delimiter(lines[i + 1])) starts.push(i)
  }
  return starts
}

function delimiter(line: string | undefined): boolean {
  const trimmed = line?.trim() ?? ''
  return trimmed.startsWith('|') && trimmed.includes('-') && /^[|\-:\s]+$/.test(trimmed)
}
