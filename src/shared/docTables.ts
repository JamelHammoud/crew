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

export function stripDocTableMarks(markdown: string): string {
  return readDocTableWidths(markdown).text
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

export type DocTableAlign = 'left' | 'center' | 'right'

export function mendDocTableRows(markdown: string): string {
  const lines = markdown.split('\n')
  const starts = new Set(tableStarts(lines))
  const out: string[] = []
  for (let i = 0; i < lines.length; ) {
    if (!starts.has(i)) {
      out.push(lines[i])
      i++
      continue
    }
    while (i < lines.length && lines[i].trim() !== '') {
      let row = lines[i]
      i++
      while (!row.trimEnd().endsWith('|') && i < lines.length) {
        row = `${row.trimEnd().replace(/\\$/, '')}<br>${lines[i]}`
        i++
      }
      out.push(row)
    }
  }
  return out.join('\n')
}

export function readDocTableAligns(markdown: string): (DocTableAlign | null)[][] {
  const lines = markdown.split('\n')
  return tableStarts(lines).map(start =>
    cells(lines[start + 1]).map(cell => {
      const left = cell.startsWith(':')
      const right = cell.endsWith(':')
      if (left && right) return 'center'
      if (right) return 'right'
      return null
    })
  )
}

export function writeDocTableAligns(markdown: string, aligns: (DocTableAlign | null)[][]): string {
  const lines = markdown.split('\n')
  const starts = tableStarts(lines)
  starts.forEach((start, index) => {
    const row = aligns[index]
    if (!row?.some(align => align === 'center' || align === 'right')) return
    const dashes = cells(lines[start + 1])
    lines[start + 1] = `| ${dashes
      .map((cell, column) => {
        const bar = '-'.repeat(Math.max(3, cell.replace(/:/g, '').length))
        if (row[column] === 'center') return `:${bar.slice(1, -1)}:`
        if (row[column] === 'right') return `${bar.slice(0, -1)}:`
        return bar
      })
      .join(' | ')} |`
  })
  return lines.join('\n')
}

export function tableAlignsOf(blocks: DocTableBlock[]): (DocTableAlign | null)[][] {
  const aligns: (DocTableAlign | null)[][] = []
  walk(blocks, block => {
    const rows = tableRows(block)
    const columns = rows[0]?.length ?? 0
    aligns.push(
      Array.from({ length: columns }, (_, column) => {
        const seen = rows.map(row => alignOf(row[column])).filter((one): one is DocTableAlign => one !== null)
        if (seen.length !== rows.length || seen.length === 0) return null
        return seen.every(one => one === seen[0]) && seen[0] !== 'left' ? seen[0] : null
      })
    )
  })
  return aligns
}

export function applyTableAligns(blocks: DocTableBlock[], aligns: (DocTableAlign | null)[][]): DocTableBlock[] {
  let index = 0
  walk(blocks, block => {
    const row = aligns[index++]
    if (!row?.some(Boolean)) return
    for (const cells of tableRows(block)) {
      cells.forEach((cell, column) => {
        if (!row[column] || !cell || typeof cell !== 'object' || Array.isArray(cell)) return
        const props = ((cell as { props?: Record<string, unknown> }).props ??= {})
        props.textAlignment = row[column]
      })
    }
  })
  return blocks
}

function tableRows(block: DocTableBlock): unknown[][] {
  const content = block.content as { rows?: { cells?: unknown[] }[] }
  return (content.rows ?? []).map(row => row.cells ?? [])
}

function alignOf(cell: unknown): DocTableAlign | null {
  if (!cell || typeof cell !== 'object' || Array.isArray(cell)) return 'left'
  const value = (cell as { props?: { textAlignment?: string } }).props?.textAlignment
  return value === 'center' || value === 'right' || value === 'left' ? value : 'left'
}

function cells(line: string | undefined): string[] {
  return (line?.trim() ?? '')
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim())
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
