import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  mendDocTableRows,
  readDocTableAligns,
  readDocTableWidths,
  stripDocTableMarks,
  writeDocTableAligns,
  writeDocTableWidths
} from '../src/shared/docTables'

const TABLE = '| a | b |\n| --- | --- |\n| c | d |'

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

describe('what markdown cannot hold on its own', () => {
  it('marks a width above the table it belongs to, with a blank line so the table still parses', () => {
    expect(writeDocTableWidths(TABLE, [[200, 90]])).toBe(`<!-- crew:cols 200 90 -->\n\n${TABLE}`)
  })

  it('writes a dash for a column nobody sized', () => {
    expect(writeDocTableWidths(TABLE, [[null, 90]])).toContain('<!-- crew:cols - 90 -->')
  })

  it('writes nothing at all for a table nobody sized, so an untouched doc does not churn', () => {
    expect(writeDocTableWidths(TABLE, [[null, null]])).toBe(TABLE)
  })

  it('reads a mark back off the file and takes it out of the words', () => {
    const read = readDocTableWidths(`<!-- crew:cols 200 90 -->\n\n${TABLE}`)
    expect(read.widths).toEqual([[200, 90]])
    expect(read.text).toBe(TABLE)
  })

  it('is idempotent, so writing twice is writing once', () => {
    const once = writeDocTableWidths(TABLE, [[200, 90]])
    expect(writeDocTableWidths(once, [[200, 90]])).toBe(once)
  })

  it('gives each table its own mark', () => {
    const two = `${TABLE}\n\ntext\n\n${TABLE}`
    expect(readDocTableWidths(writeDocTableWidths(two, [[200, 90], [50, 60]])).widths).toEqual([[200, 90], [50, 60]])
  })

  it('never takes a table out of a code fence', () => {
    const fenced = '```\n| a | b |\n| --- | --- |\n```'
    expect(writeDocTableWidths(fenced, [[200, 90]])).toBe(fenced)
  })

  it('drops a mark that names no table rather than letting it reach the words', () => {
    expect(readDocTableWidths('<!-- crew:cols 200 90 -->\n\ntext').text.trim()).toBe('text')
  })

  it('takes the marks out of what an agent is handed', () => {
    expect(stripDocTableMarks(`<!-- crew:cols 200 90 -->\n\n${TABLE}`)).toBe(TABLE)
  })
})

describe('a line break in a cell', () => {
  it('mends a row the serializer split across two lines', () => {
    expect(mendDocTableRows('| a | b |\n| --- | --- |\n| one\\\ntwo | d |')).toBe(
      '| a | b |\n| --- | --- |\n| one<br>two | d |'
    )
  })

  it('leaves a whole table alone', () => {
    expect(mendDocTableRows(TABLE)).toBe(TABLE)
  })
})

describe('column alignment, which markdown carries and BlockNote does not', () => {
  it('reads a centred and a right aligned column off the delimiter row', () => {
    expect(readDocTableAligns('| a | b | c |\n|:---:|---:|---|\n| d | e | f |')).toEqual([['center', 'right', null]])
  })

  it('writes the colons back', () => {
    expect(writeDocTableAligns(TABLE, [['center', 'right']])).toContain('| :---: | ---: |')
  })

  it('writes no colon for a table nobody aligned, so an untouched doc does not churn', () => {
    expect(writeDocTableAligns(TABLE, [[null, null]])).toBe(TABLE)
  })

  it('round trips', () => {
    const written = writeDocTableAligns(TABLE, [['center', 'right']])
    expect(readDocTableAligns(written)).toEqual([['center', 'right']])
  })
})
