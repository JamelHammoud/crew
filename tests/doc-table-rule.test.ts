import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8')

const styles = read('src/renderer/src/styles.css')
const view = read('src/renderer/src/views/Docs.tsx')

const TABLE = String.raw`\.doc \.bn-editor \[data-content-type='table'\]`

const rule = (selector: string): string => new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(styles)?.[1] ?? ''

describe('how a table is drawn', () => {
  it('reads the sheet', () => {
    expect(rule(`${TABLE} table`).length).toBeGreaterThan(0)
  })

  it('is one rounded frame rather than a grid of boxed cells', () => {
    const frame = rule(`${TABLE} \\.tableWrapper`)
    expect(frame).toMatch(/border:\s*1px solid/)
    expect(frame).toMatch(/border-radius:\s*12px/)

    const inside = rule(`${TABLE} table`)
    expect(inside).toContain('border-collapse: separate')
    expect(inside).toContain('border-spacing: 0')
    expect(inside).toContain('border: none')
  })

  it('hangs that frame off the box that scrolls, so it is whole however far the table runs', () => {
    const frame = rule(`${TABLE} \\.tableWrapper`)
    expect(frame).toContain('overflow-x: auto')
    expect(frame).toContain('border')
    expect(rule(`${TABLE} table`)).not.toContain('border-radius')
  })

  it('fills the measure it stands in rather than sitting short of it', () => {
    expect(rule(`${TABLE} table`)).toContain('width: 100% !important')
    expect(rule(`${TABLE} \\.tableWrapper`)).toContain('padding: 0')
  })

  it('draws one hairline between cells and none at the outside', () => {
    const cells = rule(`${TABLE} th,\\s*\\n${TABLE} td`)
    expect(cells).toContain('border: none')
    expect(cells).toContain('border-right: 1px solid')
    expect(cells).toContain('border-bottom: 1px solid')
    expect(rule(`${TABLE} tr > \\*:last-child`)).toContain('border-right: none')
    expect(rule(`${TABLE} tr:last-child > \\*`)).toContain('border-bottom: none')
  })

  it('scrolls inside its own box rather than pushing the column sideways', () => {
    const wrapper = rule(`${TABLE} \\.tableWrapper`)
    expect(wrapper).toContain('min-width: 0')
    expect(wrapper).toContain('max-width: 100%')
    expect(rule(TABLE)).toContain('min-width: 0')
    expect(view).toContain('overflow-x-hidden')
  })

  it('says a header row apart from the rows under it', () => {
    const head = rule(`${TABLE} th`)
    expect(head).toContain('background: var(--color-ink-800)')
    expect(head).toContain('font-weight: 600')
  })

  it('wears crew colors where blocknote ships its own', () => {
    expect(rule(`${TABLE} \\.selectedCell::after`)).toContain('var(--color-selection)')
    expect(styles).toContain('.doc .bn-editor .column-resize-handle')
    expect(styles).toContain('.doc .bn-table-drop-cursor')
  })

  it('stands its menu rows on nothing until they are hovered', () => {
    const row = rule('\\.doc \\.bn-container \\.mantine-Menu-item')
    expect(row).toContain('background: transparent')
    expect(styles).toContain('.doc .bn-container .mantine-Menu-item[data-hovered]')
    expect(styles).toContain('.light .doc .bn-container .mantine-Menu-item')
  })
})
