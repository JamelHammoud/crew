interface Range {
  from: number
  to: number
}

interface Hit {
  at: number
  run: number
}

interface Hunk {
  removed: string[]
  added: string[]
}

const norm = (line: string): string => line.trimEnd()

function trimEnds(block: string[]): string[] {
  let start = 0
  let end = block.length
  while (start < end && !block[start].trim()) start += 1
  while (end > start && !block[end - 1].trim()) end -= 1
  return block.slice(start, end)
}

function hunksOf(diff: string): Hunk[] {
  const hunks: Hunk[] = []
  let current: Hunk | null = null
  for (const raw of diff.split('\n')) {
    const sign = raw[0]
    if (sign !== '+' && sign !== '-') {
      current = null
      continue
    }
    const line = raw.startsWith(`${sign} `) ? raw.slice(2) : raw.slice(1)
    if (!current || (sign === '-' && current.added.length > 0)) {
      current = { removed: [], added: [] }
      hunks.push(current)
    }
    if (sign === '-') current.removed.push(line)
    else current.added.push(line)
  }
  return hunks
}

function runFrom(lines: string[], block: string[], start: number): number {
  let count = 0
  while (start + count < lines.length && count < block.length) {
    if (norm(lines[start + count]) !== norm(block[count])) break
    count += 1
  }
  return count
}

function locateBlock(lines: string[], block: string[]): Hit | null {
  let best: Hit | null = null
  let hits = 0
  for (let index = 0; index < lines.length; index += 1) {
    if (norm(lines[index]) !== norm(block[0])) continue
    hits += 1
    const run = runFrom(lines, block, index)
    if (!best || run > best.run) best = { at: index, run }
    if (run === block.length) break
  }
  if (!best) return null
  if (best.run < 2 && hits > 1) return null
  return best
}

function locateAll(lines: string[], block: string[]): Range[] {
  const found: Range[] = []
  let rest = block
  while (rest.length > 0) {
    const hit = locateBlock(lines, rest)
    if (!hit) break
    let end = hit.run
    while (end > 1 && !rest[end - 1].trim()) end -= 1
    found.push({ from: hit.at + 1, to: hit.at + end })
    rest = trimEnds(rest.slice(hit.run))
  }
  return found
}

export function baselineOf(text: string, diff: string | null | undefined): string | null {
  if (!diff) return null
  const lines = text.split('\n')
  const swaps: Array<Range & { gone: string[] }> = []
  let covered = 0
  let dropped = false
  for (const hunk of hunksOf(diff)) {
    const block = trimEnds(hunk.added)
    if (block.length === 0) continue
    const ranges = locateAll(lines, block)
    if (ranges.length === 0) continue
    const gone = trimEnds(hunk.removed)
    if (gone.length > 0) dropped = true
    for (const range of ranges) {
      covered += range.to - range.from + 1
      swaps.push({ ...range, gone })
    }
  }
  if (swaps.length === 0) return null
  if (!dropped && covered >= lines.filter(line => line.trim()).length) return null
  const out = [...lines]
  for (const swap of swaps.sort((a, b) => b.from - a.from)) {
    out.splice(swap.from - 1, swap.to - swap.from + 1, ...swap.gone)
  }
  return out.join('\n')
}
