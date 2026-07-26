export interface Span {
  from: number
  to: number
}

export interface Row {
  text: string
  line: number | null
  changed: boolean
  inner: Span[]
}

type Kind = 'same' | 'gone' | 'new'

interface Part {
  kind: Kind
  lines: string[]
}

const CELLS = 250_000
const GAP = 2
const TINY = 4
const LONG = 5
const MOSTLY = 0.75

function walk(from: string[], to: string[], take: (kind: Kind, one: string) => void): void {
  const rows = from.length
  const cols = to.length
  if (rows * cols > CELLS) {
    for (const one of from) take('gone', one)
    for (const one of to) take('new', one)
    return
  }
  const grid = new Uint32Array((rows + 1) * (cols + 1))
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      grid[i * (cols + 1) + j] =
        from[i] === to[j]
          ? grid[(i + 1) * (cols + 1) + j + 1] + 1
          : Math.max(grid[(i + 1) * (cols + 1) + j], grid[i * (cols + 1) + j + 1])
    }
  }
  let i = 0
  let j = 0
  while (i < rows && j < cols) {
    if (from[i] === to[j]) {
      take('same', to[j])
      i += 1
      j += 1
    } else if (grid[(i + 1) * (cols + 1) + j] >= grid[i * (cols + 1) + j + 1]) {
      take('gone', from[i])
      i += 1
    } else {
      take('new', to[j])
      j += 1
    }
  }
  while (i < rows) {
    take('gone', from[i])
    i += 1
  }
  while (j < cols) {
    take('new', to[j])
    j += 1
  }
}

function add(parts: Part[], kind: Kind, one: string): void {
  const last = parts[parts.length - 1]
  if (last && last.kind === kind) last.lines.push(one)
  else parts.push({ kind, lines: [one] })
}

function middle(gone: string[], made: string[]): Part[] {
  if (gone.length === 0 && made.length === 0) return []
  if (gone.length === 0) return [{ kind: 'new', lines: made }]
  if (made.length === 0) return [{ kind: 'gone', lines: gone }]
  const parts: Part[] = []
  walk(gone, made, (kind, one) => add(parts, kind, one))
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

function grouped(parts: Part[]): Part[] {
  const out: Part[] = []
  let at = 0
  while (at < parts.length) {
    if (parts[at].kind === 'same') {
      out.push(parts[at])
      at += 1
      continue
    }
    const gone: string[] = []
    const made: string[] = []
    while (at < parts.length && parts[at].kind !== 'same') {
      if (parts[at].kind === 'gone') gone.push(...parts[at].lines)
      else made.push(...parts[at].lines)
      at += 1
    }
    if (gone.length > 0) out.push({ kind: 'gone', lines: gone })
    if (made.length > 0) out.push({ kind: 'new', lines: made })
  }
  return out
}

function edge(parts: Part[], at: number, step: number): number {
  let index = at
  while (index + step >= 0 && index + step < parts.length && parts[index + step].kind !== 'same') index += step
  return index
}

function linesOf(parts: Part[], from: number, to: number, kind: Kind): string[] {
  const out: string[] = []
  for (let at = from; at <= to; at += 1) if (parts[at].kind === kind) out.push(...parts[at].lines)
  return out
}

function absorb(parts: Part[]): Part[] | null {
  for (let at = 1; at < parts.length - 1; at += 1) {
    if (parts[at].kind !== 'same') continue
    if (parts[at - 1].kind === 'same' || parts[at + 1].kind === 'same') continue
    if (parts[at].lines.join('').replace(/\s/g, '').length > TINY) continue
    const from = edge(parts, at - 1, -1)
    const to = edge(parts, at + 1, 1)
    const around = [
      linesOf(parts, from, at - 1, 'gone'),
      linesOf(parts, from, at - 1, 'new'),
      linesOf(parts, at + 1, to, 'gone'),
      linesOf(parts, at + 1, to, 'new')
    ]
    if (!around.some(block => block.length > LONG)) continue
    return [
      ...parts.slice(0, from),
      { kind: 'gone', lines: [...around[0], ...parts[at].lines, ...around[2]] },
      { kind: 'new', lines: [...around[1], ...parts[at].lines, ...around[3]] },
      ...parts.slice(to + 1)
    ]
  }
  return null
}

function settled(parts: Part[]): Part[] {
  let list = grouped(parts)
  for (let pass = 0; pass < 10; pass += 1) {
    const next = absorb(list)
    if (!next) break
    list = next
  }
  return list
}

function words(text: string): string[] {
  return text.match(/\w+|\s+|[^\w\s]/g) ?? []
}

function mark(spans: Span[], from: number, to: number): void {
  const last = spans[spans.length - 1]
  if (last && from - last.to <= GAP) last.to = to
  else spans.push({ from, to })
}

function covered(spans: Span[]): number {
  return spans.reduce((sum, span) => sum + span.to - span.from, 0)
}

function inner(from: string, to: string): { gone: Span[]; made: Span[] } {
  const gone: Span[] = []
  const made: Span[] = []
  let left = 0
  let right = 0
  walk(words(from), words(to), (kind, one) => {
    if (kind !== 'new') {
      if (kind === 'gone') mark(gone, left, left + one.length)
      left += one.length
    }
    if (kind !== 'gone') {
      if (kind === 'new') mark(made, right, right + one.length)
      right += one.length
    }
  })
  const most = covered(gone) > from.length * MOSTLY || covered(made) > to.length * MOSTLY
  return most ? { gone: [], made: [] } : { gone, made }
}

export function plainRows(text: string): Row[] {
  return text.split('\n').map((one, index) => ({ text: one, line: index + 1, changed: false, inner: [] }))
}

export function diffRows(baseline: string, text: string): Row[] {
  const rows: Row[] = []
  let line = 0
  let goneAt = -1
  let goneCount = 0
  for (const part of settled(parted(baseline.split('\n'), text.split('\n')))) {
    if (part.kind === 'gone') {
      goneAt = rows.length
      goneCount = part.lines.length
      for (const one of part.lines) rows.push({ text: one, line: null, changed: true, inner: [] })
      continue
    }
    const madeAt = rows.length
    for (const one of part.lines) {
      line += 1
      rows.push({ text: one, line, changed: part.kind === 'new', inner: [] })
    }
    if (part.kind === 'new' && goneAt + goneCount === madeAt && goneAt >= 0) {
      for (let at = 0; at < Math.min(goneCount, part.lines.length); at += 1) {
        const pair = inner(rows[goneAt + at].text, rows[madeAt + at].text)
        rows[goneAt + at].inner = pair.gone
        rows[madeAt + at].inner = pair.made
      }
    }
    goneAt = -1
    goneCount = 0
  }
  return rows
}

export function joinRows(rows: Row[]): string {
  return rows.map(row => row.text).join('\n')
}

export function docText(rows: Row[]): string {
  return rows
    .filter(row => row.line !== null)
    .map(row => row.text)
    .join('\n')
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

function startOf(rows: Row[], at: number): number {
  let start = 0
  for (let index = 0; index < at; index += 1) start += rows[index].text.length + 1
  return start
}

export function snap(rows: Row[], at: number, back: boolean): number {
  const here = rowAt(rows, at).index
  if (!rows[here] || rows[here].line !== null) return at
  let up = here
  while (up >= 0 && rows[up].line === null) up -= 1
  let down = here
  while (down < rows.length && rows[down].line === null) down += 1
  const behind = back ? up >= 0 : down >= rows.length
  const pick = behind ? up : down
  if (pick < 0 || pick >= rows.length) return at
  return behind ? startOf(rows, pick) + rows[pick].text.length : startOf(rows, pick)
}

export function editDoc(rows: Row[], doc: string, before: string, after: string): { text: string; at: number } {
  const max = Math.min(before.length, after.length)
  let head = 0
  while (head < max && before[head] === after[head]) head += 1
  let tail = 0
  while (tail < max - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail += 1
  const put = after.slice(head, after.length - tail)
  const end = before.length - tail
  const from = toDoc(rows, head)
  const to = toDoc(rows, end)
  const at = from === to && put.length === 0 && end > head ? Math.max(0, from - 1) : from
  return { text: doc.slice(0, at) + put + doc.slice(to), at: at + put.length }
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
