import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')

type Rung = { level: number; body: string }

const blocks = (): string[] => styles.split('\n\n')

const rungs = (): Rung[] => {
  const found: Rung[] = []
  for (const block of blocks()) {
    const opens = block.indexOf('{')
    if (opens < 0) continue
    const head = block.slice(0, opens)
    const body = block.slice(opens)
    if (!head.includes('.doc ')) continue
    if (!head.includes("numberedListItem']::before")) continue
    if (!body.includes('counter(doc-order')) continue
    found.push({ level: head.split('.bn-block-group').length - 1 || 1, body })
  }
  return found.sort((a, b) => a.level - b.level)
}

const styleOf = (body: string): string => {
  const said = /counter\(doc-order(?:,\s*([a-z-]+))?\)/.exec(body)
  return said?.[1] ?? 'decimal'
}

const resets = (): string[] =>
  blocks()
    .filter(block => block.includes('.doc ') && block.includes('counter-reset: doc-order'))
    .map(block => block.slice(block.indexOf('{')))

describe('a numbered list in a doc', () => {
  it('counts off the index the editor already worked out rather than counting again', () => {
    const [own] = resets()
    expect(own).toContain('counter-reset: doc-order attr(data-index type(<integer>), 1)')
  })

  it('reads the index the same way while a block is changing type', () => {
    const said = resets()
    expect(said.length).toBe(2)
    expect(said[1]).toContain('counter-reset: doc-order attr(data-prev-index type(<integer>), 1)')
  })

  it('starts over every three levels, numbers, letters, roman', () => {
    const cycle = ['decimal', 'lower-alpha', 'lower-roman']
    const walk = rungs()
    expect(walk.map(rung => rung.level)).toEqual([1, 2, 3, 4, 5, 6])
    expect(walk.map(rung => styleOf(rung.body))).toEqual([...cycle, ...cycle])
  })

  it('writes the marker out at every level, so nothing is left to the rung above', () => {
    for (const rung of rungs()) expect(rung.body).toContain("'.'")
  })

  it('takes the marker off the editor rather than leaving the glyph a face happens to carry', () => {
    for (const rung of rungs()) expect(rung.body).not.toContain('var(--index)')
  })
})
