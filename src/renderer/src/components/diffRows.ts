export interface Row {
  text: string
  line: number | null
  changed: boolean
}

type Kind = 'same' | 'gone' | 'new'

interface Part {
  kind: Kind
  lines: string[]
}

const CELLS = 250_000

function add(parts: Part[], kind: Kind, line: string): void {
  const last = parts[parts.length - 1]
  if (last && last.kind === kind) last.lines.push(line)
  else parts.push({ kind, lines: [line] })
}

function middle(gone: string[], made: string[]): Part[] {
  if (gone.length === 0 && made.length === 0) return []
  if (gone.length === 0) return [{ kind: 'new', lines: made }]
  if (made.length === 0) return [{ kind: 'gone', lines: gone }]
  if (gone.length * made.length > CELLS) {
    return [
      { kind: 'gone', lines: gone },
      { kind: 'new', lines: made }
    ]
  }
  const rows = gone.length
  const cols = made.length
  const grid = new Uint32Array((rows + 1) * (cols + 1))
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      grid[i * (cols + 1) + j] =
        gone[i] === made[j]
          ? grid[(i + 1) * (cols + 1) + j + 1] + 1
          : Math.max(grid[(i + 1) * (cols + 1) + j], grid[i * (cols + 1) + j + 1])
    }
  }
  const parts: Part[] = []
  let i = 0
  let j = 0
  while (i < rows && j < cols) {
    if (gone[i] === made[j]) {
      add(parts, 'same', made[j])
      i += 1
      j += 1
    } else if (grid[(i + 1) * (cols + 1) + j] >= grid[i * (cols + 1) + j + 1]) {
      add(parts, 'gone', gone[i])
      i += 1
    } else {
      add(parts, 'new', made[j])
      j += 1
    }
  }
  while (i < rows) {
    add(parts, 'gone', gone[i])
    i += 1
  }
  while (j < cols) {
    add(parts, 'new', made[j])
    j += 1
  }
  return parts
}

function parted(from: string[], to: string[]): Part[] {
  let head = 0
  while (head < from.length && head < to.length && from[head] === to[head]) head += 1
  let tail = 0
  while (
    tail < from.length - head &&
    tail < to.length - head &&
    from[from.length - 1 - tail] === to[to.length - 1 - tail]
  ) {
    tail += 1
  }
  const parts: Part[] = []
  if (head > 0) parts.push({ kind: 'same', lines: to.slice(0, head) })
  parts.push(...middle(from.slice(head, from.length - tail), to.slice(head, to.length - tail)))
  if (tail > 0) parts.push({ kind: 'same', lines: to.slice(to.length - tail) })
  return parts
}

export function plainRows(text: string): Row[] {
  return text.split('\n').map((line, index) => ({ text: line, line: index + 1, changed: false }))
}

export function diffRows(baseline: string, text: string): Row[] {
  const rows: Row[] = []
  let line = 0
  for (const part of parted(baseline.split('\n'), text.split('\n'))) {
    for (const one of part.lines) {
      if (part.kind === 'gone') rows.push({ text: one, line: null, changed: true })
      else {
        line += 1
        rows.push({ text: one, line, changed: part.kind === 'new' })
      }
    }
  }
  return rows
}

export function joinRows(rows: Row[]): string {
  return rows.map(row => row.text).join('\n')
}

export function toDoc(rows: Row[], at: number): number {
  let shown = 0
  let doc = 0
  for (const row of rows) {
    const end = shown + row.text.length
    if (at <= end) return row.line === null ? doc : doc + (at - shown)
    shown = end + 1
    if (row.line !== null) doc += row.text.length + 1
  }
  return Math.max(0, doc - 1)
}

export function toShown(rows: Row[], at: number): number {
  let shown = 0
  let doc = 0
  for (const row of rows) {
    if (row.line !== null) {
      const end = doc + row.text.length
      if (at <= end) return shown + (at - doc)
      doc = end + 1
    }
    shown += row.text.length + 1
  }
  return Math.max(0, shown - 1)
}

export function rowAt(rows: Row[], at: number): { index: number; start: number } {
  let start = 0
  for (let index = 0; index < rows.length; index += 1) {
    const end = start + rows[index].text.length
    if (at <= end) return { index, start }
    start = end + 1
  }
  const index = Math.max(0, rows.length - 1)
  return { index, start: Math.max(0, start - (rows[index]?.text.length ?? 0) - 1) }
}

export function firstChange(rows: Row[]): number | null {
  const at = rows.findIndex(row => row.changed)
  if (at < 0) return null
  for (let index = at; index < rows.length; index += 1) {
    if (rows[index].line !== null) return rows[index].line
  }
  for (let index = at; index >= 0; index -= 1) {
    if (rows[index].line !== null) return rows[index].line
  }
  return null
}
