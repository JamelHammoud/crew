import { diffRows, type Row } from './diffRows'

interface Block {
  removed: string[]
  added: string[]
}

function blocksOf(diff: string): Block[] {
  const blocks: Block[] = []
  let block: Block | null = null
  for (const line of diff.split('\n')) {
    const removed = line.startsWith('-')
    const added = line.startsWith('+')
    if (!removed && !added) continue
    if (line.startsWith('---') || line.startsWith('+++')) continue
    if (!block || (removed && block.added.length > 0)) {
      block = { removed: [], added: [] }
      blocks.push(block)
    }
    const text = line.slice(1).replace(/^ /, '')
    if (removed) block.removed.push(text)
    else block.added.push(text)
  }
  return blocks
}

export function rowsOf(diff: string): Row[] {
  const rows: Row[] = []
  let offset = 0
  for (const block of blocksOf(diff)) {
    const made =
      block.removed.length === 0
        ? block.added.map((text, index) => ({ text, line: index + 1, changed: true, inner: [] }))
        : block.added.length === 0
          ? block.removed.map(text => ({ text, line: null, changed: true, inner: [] }))
          : diffRows(block.removed.join('\n'), block.added.join('\n'))
    for (const row of made) if (row.line !== null) row.line += offset
    offset += block.added.length
    rows.push(...made)
  }
  return rows
}
