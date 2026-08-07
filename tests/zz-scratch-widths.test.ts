// @vitest-environment jsdom
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

const { BlockNoteEditor } = await import('@blocknote/core')
const { docSchema } = await import('../src/renderer/src/components/doc/docSchema')
const {
  applyTableAligns,
  applyTableWidths,
  mendDocTableRows,
  readDocTableAligns,
  readDocTableWidths,
  tableAlignsOf,
  tableWidthsOf,
  writeDocTableAligns,
  writeDocTableWidths
} = await import('../src/shared/docTables')

const editor = () => BlockNoteEditor.create({ schema: docSchema as never }) as never as any

const save = (e: any) => {
  const md = mendDocTableRows(e.blocksToMarkdownLossy(e.document))
  return writeDocTableWidths(writeDocTableAligns(md, tableAlignsOf(e.document)), tableWidthsOf(e.document))
}

const load = (text: string) => {
  const e = editor()
  const read = readDocTableWidths(text)
  const aligns = readDocTableAligns(read.text)
  const blocks = e.tryParseMarkdownToBlocks(read.text)
  applyTableWidths(blocks, read.widths)
  applyTableAligns(blocks, aligns)
  e.replaceBlocks(e.document, blocks)
  return e
}

const table = (e: any) => e.document.find((b: any) => b.type === 'table')

describe('a table survives being written out and read back', () => {
  it('keeps a column width', () => {
    const one = editor()
    one.replaceBlocks(one.document, [
      {
        type: 'table',
        content: { type: 'tableContent', headerRows: 1, columnWidths: [200, 90], rows: [{ cells: ['a', 'b'] }, { cells: ['c', 'd'] }] }
      }
    ])
    const text = save(one)
    expect(text).toContain('<!-- crew:cols 200 90 -->')
    expect(table(load(text)).content.columnWidths).toEqual([200, 90])
  })

  it('keeps a width on one column and leaves the other free', () => {
    const text = writeDocTableWidths('| a | b |\n| --- | --- |\n| c | d |\n', [[null, 90]])
    expect(text).toContain('<!-- crew:cols - 90 -->')
    expect(table(load(text)).content.columnWidths).toEqual([null, 90])
  })

  it('writes no mark for a table nobody resized, so an untouched doc does not churn', () => {
    const one = load('| a | b |\n| --- | --- |\n| c | d |\n')
    expect(save(one)).not.toContain('crew:cols')
  })

  it('is stable, so opening a doc and saving it changes nothing', () => {
    const text = save(load('<!-- crew:cols 200 90 -->\n\n| a | b |\n| --- | --- |\n| c | d |\n'))
    expect(save(load(text))).toBe(text)
  })

  it('keeps each table its own widths when there are several', () => {
    const text = writeDocTableWidths(
      '| a | b |\n| --- | --- |\n| c | d |\n\ntext\n\n| e | f |\n| --- | --- |\n| g | h |\n',
      [[200, 90], [50, 60]]
    )
    const tables = load(text).document.filter((b: any) => b.type === 'table')
    expect(tables.map((t: any) => t.content.columnWidths)).toEqual([[200, 90], [50, 60]])
  })

  it('never reads a table out of a code fence', () => {
    const fenced = '```\n| a | b |\n| --- | --- |\n```\n\n| c | d |\n| --- | --- |\n| e | f |\n'
    expect(writeDocTableWidths(fenced, [[200, 90]]).indexOf('crew:cols')).toBeGreaterThan(fenced.indexOf('```\n| a'))
  })

  it('keeps a centred and a right aligned column', () => {
    const back = load('| a | b | c |\n|:---:|---:|---|\n| d | e | f |\n')
    const rows = table(back).content.rows
    expect(rows[0].cells.map((c: any) => c.props.textAlignment)).toEqual(['center', 'right', 'left'])
    expect(save(back)).toContain(':')
  })

  it('does not strip alignment from a doc nobody edited', () => {
    const text = save(load('| a | b |\n|:---:|---:|\n| c | d |\n'))
    const rows = table(load(text)).content.rows
    expect(rows[1].cells.map((c: any) => c.props.textAlignment)).toEqual(['center', 'right'])
  })

  it('writes no colon for a table nobody aligned', () => {
    expect(save(load('| a | b |\n| --- | --- |\n| c | d |\n'))).not.toContain(':--')
  })

  it('keeps a line break in a cell rather than breaking the table open', () => {
    const back = load('| a | b |\n| --- | --- |\n| one<br>two | d |\n')
    expect(table(back).content.rows.length).toBe(2)
    const text = save(back)
    expect(text).toContain('<br>')
    const again = load(text)
    expect(table(again).content.rows.length).toBe(2)
    expect(JSON.stringify(table(again).content.rows[1])).toContain('two')
  })

  it('mends a row the serializer split across two lines', () => {
    expect(mendDocTableRows('| a | b |\n| --- | --- |\n| one\\\ntwo | d |\n')).toBe(
      '| a | b |\n| --- | --- |\n| one<br>two | d |\n'
    )
  })
})
