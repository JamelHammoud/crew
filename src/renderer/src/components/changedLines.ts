export interface ChangedLines {
  lines: Set<number>
  first: number
}

interface Range {
  from: number
  to: number
}

interface Hit {
  at: number
  run: number
}

const norm = (line: string): string => line.trimEnd()

function trimEnds(block: string[]): string[] {
  let start = 0
  let end = block.length
  while (start < end && !block[start].trim()) start += 1
  while (end > start && !block[end - 1].trim()) end -= 1
  return block.slice(start, end)
}

function addedBlocks(diff: string): string[][] {
  const blocks: string[][] = []
  let block: string[] = []
  for (const line of diff.split('\n')) {
    if (line.startsWith('+')) {
      block.push(line.startsWith('+ ') ? line.slice(2) : line.slice(1))
      continue
    }
    if (block.length) blocks.push(block)
    block = []
  }
  if (block.length) blocks.push(block)
  return blocks.map(trimEnds).filter(block => block.length > 0)
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

export function changedLines(text: string, diff: string | null | undefined): ChangedLines | null {
  if (!diff) return null
  const lines = text.split('\n')
  const found = addedBlocks(diff).flatMap(block => locateAll(lines, block))
  if (found.length === 0) return null
  const marked = new Set<number>()
  for (const range of found) {
    for (let line = range.from; line <= range.to; line += 1) marked.add(line)
  }
  if (marked.size >= lines.filter(line => line.trim()).length) return null
  return { lines: marked, first: Math.min(...found.map(range => range.from)) }
}
