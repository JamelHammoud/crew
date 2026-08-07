import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const styles = read('src/renderer/src/styles.css')
const layout = read('src/renderer/src/components/doc/docsLayout.ts')
const number = (name: string): number => {
  const found = new RegExp(`export const ${name} = (\\d+)`).exec(layout)
  expect(found, name).toBeTruthy()
  return Number(found![1])
}
const handles = read('src/renderer/src/components/doc/DocTableHandles.tsx')
const editor = read('src/renderer/src/components/DocEditor.tsx')

const rule = (selector: string): string => {
  const at = styles.indexOf(selector)
  expect(at, selector).toBeGreaterThan(-1)
  return styles.slice(at, styles.indexOf('\n}', at))
}

const WRAPPER = ".doc .bn-editor [data-content-type='table'] .tableWrapper"

const wrapperSets = (property: string): boolean => new RegExp(`\\n\\s*${property}\\s*:`).test(rule(WRAPPER))

describe('what a doc table offers', () => {
  it('offers a header row, which markdown carries', () => {
    expect(handles).toContain('Header row')
  })

  it('offers no header column, because markdown loses one', () => {
    expect(handles).not.toContain('Header column')
    expect(handles).not.toContain('TableHeaderColumn')
  })

  it('turns cell colour and merging off, because markdown loses both', () => {
    expect(editor).toContain('tables: { headers: true }')
    expect(editor).not.toContain('cellBackgroundColor')
    expect(editor).not.toContain('cellTextColor')
    expect(editor).not.toContain('splitCells')
  })

  it('puts the one press that cannot be undone last', () => {
    expect(handles.indexOf('Add above')).toBeLessThan(handles.indexOf('Delete row'))
    expect(handles.indexOf('Header row')).toBeLessThan(handles.indexOf('Delete row'))
  })
})

describe('the room a table stands in', () => {
  it('leaves the gutter the handles and the two add bars are revealed in', () => {
    expect(wrapperSets('padding')).toBe(false)
  })

  it('gives that gutter back, so the table stands on the writing own edge', () => {
    expect(rule(WRAPPER)).toContain(
      'margin-inline: calc(var(--bn-table-handle-size) * -1) calc(var(--bn-table-widget-size) * -1)'
    )
    expect(rule(WRAPPER)).toContain('width: calc(100% + var(--bn-table-handle-size) + var(--bn-table-widget-size))')
    expect(rule(WRAPPER)).toContain('margin-bottom: calc(var(--doc-table-gap) - var(--bn-table-widget-size))')
  })

  it('writes the measure down once, and it is the writing column', () => {
    expect(rule(':root {')).toContain(`--doc-measure: ${number('DOC_MAX_W') - number('DOC_GUTTER') * 2}px`)
  })

  it('holds the add row bar inside the writing, whatever the table is scrolled to', () => {
    expect(rule('.doc .bn-container .bn-extend-button-add-remove-rows')).toContain('max-width: var(--doc-measure)')
  })
})

describe('the grid', () => {
  it('draws its outline on the cells, so nothing has to clip', () => {
    expect(wrapperSets('border')).toBe(false)
    expect(wrapperSets('border-radius')).toBe(false)
    expect(wrapperSets('overflow')).toBe(false)
    for (const corner of [
      'tr:first-child > *:first-child {\n  border-top-left-radius',
      'tr:first-child > *:last-child {\n  border-top-right-radius',
      'tr:last-child > *:first-child {\n  border-bottom-left-radius',
      'tr:last-child > *:last-child {\n  border-bottom-right-radius'
    ])
      expect(styles, corner).toContain(corner)
  })

  it('sets its own line rather than taking the writing one', () => {
    expect(rule(".doc .bn-editor [data-content-type='table'] table")).toContain('line-height: 1.5')
    expect(rule(".doc .bn-editor [data-content-type='table'] th,")).toContain('padding: 7px 11px')
  })

  it('holds an empty cell open on one line and no more', () => {
    expect(rule(".doc .bn-editor [data-content-type='table'] th > p,")).toContain('min-height: 1lh')
  })

  it('says which row the pointer is on, and never the header', () => {
    expect(rule(".doc .bn-editor [data-content-type='table'] tr:hover > td")).toContain(
      'background: var(--color-ink-hover)'
    )
  })
})

describe('the handles are Crew own', () => {
  it('turns BlockNote off rather than standing beside it', () => {
    expect(editor).toContain('tableHandles={false}')
    expect(editor).toContain('<DocTableHandles />')
  })

  it('wears a bar rather than a card, in both directions off one box', () => {
    expect(handles).toContain("row ? 'w-1 h-4' : 'w-4 h-1'")
    expect(handles).toContain('w-5 h-6')
  })

  it('leaves nothing of Mantine to style', () => {
    expect(styles).not.toContain('.bn-table-handle')
    expect(styles).not.toContain('.bn-table-cell-handle')
  })
})
