import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')

type Rung = { level: number; body: string }

const rungs = (): Rung[] => {
  const found: Rung[] = []
  const wanted = "bulletListItem']::before"
  for (let at = styles.indexOf(wanted); at > -1; at = styles.indexOf(wanted, at + 1)) {
    const opens = styles.indexOf('{', at)
    const head = styles.slice(styles.lastIndexOf('\n\n', at) + 2, opens)
    if (!head.includes('.doc ')) continue
    const deep = head.split('.bn-block-group').length - 1
    found.push({ level: deep || 1, body: styles.slice(opens, styles.indexOf('\n}', opens)) })
  }
  return found.sort((a, b) => a.level - b.level)
}

const said = (body: string, name: string): string => {
  const found = body.match(new RegExp(`\\n\\s*${name}:\\s*([^;]+);`))
  if (found) return found[1].trim()
  if (name === 'border-width') return said(body, 'border').split(' ')[0]
  return ''
}

const shapeOf = (body: string): string => {
  if (parseFloat(said(body, 'border-width')) > 0) return 'ring'
  return said(body, 'border-radius') === '50%' ? 'disc' : 'square'
}

const sizeOf = (body: string): number => parseFloat(said(body, '--doc-bullet'))

describe('a bullet in a doc', () => {
  it('is drawn rather than set, so one is never the glyph a face happens to carry', () => {
    const [first] = rungs()
    expect(first.level).toBe(1)
    expect(first.body).toContain("content: ''")
    expect(first.body).toContain('background: var(--color-fg-muted)')
    expect(first.body).toContain('border: 0 solid var(--color-fg-muted)')
  })

  it('paints out the character rather than trusting it to be gone', () => {
    const [first] = rungs()
    expect(first.body).toContain('color: transparent')
    expect(first.body).toContain('overflow: hidden')
  })

  it('starts over every three levels, filled, outlined, square', () => {
    const cycle = ['disc', 'ring', 'square']
    const walk = rungs()
    expect(walk.map(rung => rung.level)).toEqual([1, 2, 3, 4, 5, 6])
    expect(walk.map(rung => shapeOf(rung.body))).toEqual([...cycle, ...cycle])
  })

  it('names every part of the shape at every level, so nothing is left to the rung above', () => {
    for (const rung of rungs()) {
      for (const part of ['--doc-bullet', 'border-width', 'border-radius', 'background']) {
        expect(said(rung.body, part)).not.toBe('')
      }
    }
  })

  it('holds the square under the circle, since equal on the ruler is not equal to the eye', () => {
    const walk = rungs()
    const round = walk.filter(rung => shapeOf(rung.body) !== 'square').map(rung => sizeOf(rung.body))
    const square = walk.filter(rung => shapeOf(rung.body) === 'square').map(rung => sizeOf(rung.body))
    expect(new Set(round).size).toBe(1)
    expect(new Set(square).size).toBe(1)
    expect(square[0]).toBeLessThan(round[0])
  })

  it('stands in the same gutter whatever size it is drawn at', () => {
    const { body } = rungs()[0]
    const left = parseFloat(said(body, 'margin-left').replace('calc(', ''))
    const right = parseFloat(said(body, 'margin-right').replace('calc(', ''))
    expect(said(body, 'margin-left')).toBe('calc(10px - var(--doc-bullet) / 2)')
    expect(said(body, 'margin-right')).toBe('calc(14px - var(--doc-bullet) / 2)')
    expect(left + right).toBe(24)
  })

  it('sits on the middle of the line it stands beside rather than on a share of the font', () => {
    const { body } = rungs()[0]
    expect(said(body, 'margin-top')).toBe('calc(0.5lh - var(--doc-bullet) / 2)')
    expect(said(body, 'margin-top')).not.toContain('em')
  })
})

describe('a sub-bullet', () => {
  it('has no line down its left', () => {
    expect(styles).toContain('.bn-block-group .bn-block-outer::before')
    const at = styles.indexOf('.bn-block-group .bn-block-outer::before')
    expect(styles.slice(at, styles.indexOf('\n}', at))).toContain('border-left-width: 0')
  })

  it('never draws one anywhere else either', () => {
    const drawn = [...styles.matchAll(/border-left:[^;]+;/g)].map(hit => hit.index ?? 0)
    for (const at of drawn) {
      const head = styles.slice(styles.lastIndexOf('\n\n', at) + 2, styles.indexOf('{', styles.lastIndexOf('}', at)))
      expect(head).not.toContain('bn-block-outer')
    }
  })
})
