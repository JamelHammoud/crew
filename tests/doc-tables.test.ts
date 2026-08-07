// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')
const handles = readFileSync(path.join(root, 'src/renderer/src/components/doc/DocTableHandles.tsx'), 'utf8')

const rule = (selector: string): string => {
  const at = styles.indexOf(selector)
  expect(at, selector).toBeGreaterThan(-1)
  return styles.slice(at, styles.indexOf('\n}', at))
}

const { BlockNoteEditor } = await import('@blocknote/core')
const { docSchema } = await import('../src/renderer/src/components/doc/docSchema')
const { DOC_GUTTER, DOC_MAX_W } = await import('../src/renderer/src/components/doc/docsLayout')

const editor = () => BlockNoteEditor.create({ schema: docSchema as never }) as never as {
  document: any[]
  replaceBlocks: (a: unknown[], b: unknown[]) => void
  blocksToMarkdownLossy: (blocks: unknown[]) => string
  tryParseMarkdownToBlocks: (markdown: string) => unknown[]
}

const table = (extra: Record<string, unknown>) => ({
  type: 'table',
  content: { type: 'tableContent', ...extra, rows: [{ cells: ['a', 'b'] }, { cells: ['c', 'd'] }] }
})

const roundTrip = (extra: Record<string, unknown>) => {
  const one = editor()
  one.replaceBlocks(one.document, [table(extra) as never])
  const markdown = one.blocksToMarkdownLossy(one.document)
  const back = editor()
  back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(markdown))
  return back.document[0].content
}

describe('what a doc table offers', () => {
  it('keeps a header row, so the menu offers one', () => {
    expect(roundTrip({ headerRows: 1 }).headerRows).toBe(1)
    expect(handles).toContain('Header row')
  })

  it('loses a header column, so the menu offers none', () => {
    const back = roundTrip({ headerCols: 1 })
    expect(back.headerCols).toBeUndefined()
    expect(handles).not.toContain('Header column')
    expect(handles).not.toContain('TableHeaderColumn')
  })

  it('loses a cell colour and a merge, so neither is turned on', () => {
    const editorSource = readFileSync(path.join(root, 'src/renderer/src/components/DocEditor.tsx'), 'utf8')
    expect(editorSource).toContain('tables: { headers: true }')
    expect(editorSource).not.toContain('cellBackgroundColor')
    expect(editorSource).not.toContain('cellTextColor')
    expect(editorSource).not.toContain('splitCells')
  })

  it('puts the one press that cannot be undone last', () => {
    expect(handles.indexOf('Add above')).toBeLessThan(handles.indexOf('Delete row'))
    expect(handles.indexOf('Header row')).toBeLessThan(handles.indexOf('Delete row'))
  })
})

describe('the room a table stands in', () => {
  const wrap = () => rule(".doc .bn-editor [data-content-type='table'] .tableWrapper")

  it('leaves the handles and the two add bars the gutter they are revealed in', () => {
    expect(wrap()).not.toContain('padding: 0')
    expect(wrap()).not.toContain('padding:')
  })

  it('gives that gutter back, so the table stands on the writing own edge', () => {
    expect(wrap()).toContain(
      'margin-inline: calc(var(--bn-table-handle-size) * -1) calc(var(--bn-table-widget-size) * -1)'
    )
    expect(wrap()).toContain('width: calc(100% + var(--bn-table-handle-size) + var(--bn-table-widget-size))')
    expect(wrap()).toContain('margin-bottom: calc(var(--doc-table-gap) - var(--bn-table-widget-size))')
  })

  it('writes the measure down once, and it is the writing column', () => {
    expect(rule(':root {')).toContain(`--doc-measure: ${DOC_MAX_W - DOC_GUTTER * 2}px`)
  })

  it('holds the add row bar inside it, whatever the table is scrolled to', () => {
    expect(rule('.doc .bn-container .bn-extend-button-add-remove-rows')).toContain('max-width: var(--doc-measure)')
  })
})

describe('the grid', () => {
  it('draws its outline on the cells, so nothing has to clip', () => {
    expect(wrapHas('border')).toBe(false)
    expect(wrapHas('border-radius')).toBe(false)
    expect(wrapHas('overflow: hidden')).toBe(false)
    for (const corner of [
      "tr:first-child > *:first-child {\n  border-top-left-radius",
      "tr:first-child > *:last-child {\n  border-top-right-radius",
      "tr:last-child > *:first-child {\n  border-bottom-left-radius",
      "tr:last-child > *:last-child {\n  border-bottom-right-radius"
    ])
      expect(styles).toContain(corner)
  })

  it('sets its own line rather than taking the writing one', () => {
    expect(rule(".doc .bn-editor [data-content-type='table'] table")).toContain('line-height: 1.5')
    expect(rule(".doc .bn-editor [data-content-type='table'] th,")).toContain('padding: 7px 11px')
  })

  it('holds an empty cell open on one line and no more', () => {
    expect(rule(".doc .bn-editor [data-content-type='table'] th > p,")).toContain('min-height: 1lh')
  })

  it('says which row the pointer is on', () => {
    expect(rule(".doc .bn-editor [data-content-type='table'] tr:hover > td")).toContain(
      'background: var(--color-ink-hover)'
    )
  })
})

function wrapHas(property: string): boolean {
  const at = styles.indexOf(".doc .bn-editor [data-content-type='table'] .tableWrapper")
  const body = styles.slice(at, styles.indexOf('\n}', at))
  return new RegExp(`\\n\\s*${property}\\s*:`).test(body)
}

describe('the handles are Crew own', () => {
  it('turns BlockNote off rather than standing beside it', () => {
    const editorSource = readFileSync(path.join(root, 'src/renderer/src/components/DocEditor.tsx'), 'utf8')
    expect(editorSource).toContain('tableHandles={false}')
    expect(editorSource).toContain('<DocTableHandles />')
  })

  it('wears a bar rather than a card, in both directions off one box', () => {
    expect(handles).toContain("row ? 'w-1 h-4' : 'w-4 h-1'")
    expect(handles).toContain('w-5 h-6')
  })

  it('leaves nothing of Mantine to style', () => {
    expect(styles).not.toContain('.bn-table-handle,')
    expect(styles).not.toContain('.bn-table-cell-handle')
  })
})
