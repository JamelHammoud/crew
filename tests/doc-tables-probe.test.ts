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

const editor = () => BlockNoteEditor.create({ schema: docSchema as never }) as never as {
  document: any[]
  replaceBlocks: (a: unknown[], b: unknown[]) => void
  blocksToMarkdownLossy: (blocks: unknown[]) => string
  tryParseMarkdownToBlocks: (markdown: string) => unknown[]
}

const roundTrip = (extra: Record<string, unknown>) => {
  const one = editor()
  one.replaceBlocks(one.document, [
    {
      type: 'table',
      content: { type: 'tableContent', ...extra, rows: [{ cells: ['a', 'b'] }, { cells: ['c', 'd'] }] }
    } as never
  ])
  const back = editor()
  back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(one.blocksToMarkdownLossy(one.document)))
  return back.document[0].content
}

describe('what a table keeps when the doc is written back out', () => {
  it('keeps its rows and its cells', () => {
    const back = roundTrip({ headerRows: 1 })
    expect(back.rows.length).toBe(2)
    expect(JSON.stringify(back.rows)).toContain('"d"')
  })

  it('keeps a header row, which is why one is offered', () => {
    expect(roundTrip({ headerRows: 1 }).headerRows).toBe(1)
  })

  it('loses a header column, which is why none is offered', () => {
    expect(roundTrip({ headerCols: 1 }).headerCols).toBeUndefined()
  })

  it('turns a header column into a header row, which is worse than losing it', () => {
    expect(roundTrip({ headerCols: 1 }).headerRows).toBe(1)
  })

  it('loses a column width on its own, which is why Crew writes one down beside the table', () => {
    expect(roundTrip({ headerRows: 1, columnWidths: [200, 90] }).columnWidths).toEqual([undefined, undefined])
  })
})

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

const save = (one: any) => {
  const markdown = mendDocTableRows(one.blocksToMarkdownLossy(one.document))
  return writeDocTableWidths(writeDocTableAligns(markdown, tableAlignsOf(one.document)), tableWidthsOf(one.document))
}

const load = (text: string) => {
  const back = editor() as any
  const read = readDocTableWidths(text)
  const aligns = readDocTableAligns(read.text)
  const blocks = back.tryParseMarkdownToBlocks(read.text)
  applyTableWidths(blocks, read.widths)
  applyTableAligns(blocks, aligns)
  back.replaceBlocks(back.document, blocks)
  return back
}

const only = (one: any) => one.document.find((block: any) => block.type === 'table')

describe('what a table keeps once Crew carries the rest', () => {
  it('keeps a column width', () => {
    const one = editor() as any
    one.replaceBlocks(one.document, [
      {
        type: 'table',
        content: { type: 'tableContent', headerRows: 1, columnWidths: [200, 90], rows: [{ cells: ['a', 'b'] }, { cells: ['c', 'd'] }] }
      }
    ])
    expect(only(load(save(one))).content.columnWidths).toEqual([200, 90])
  })

  it('keeps a width on one column and leaves the other free', () => {
    const text = writeDocTableWidths('| a | b |\n| --- | --- |\n| c | d |\n', [[null, 90]])
    expect(only(load(text)).content.columnWidths).toEqual([undefined, 90])
  })

  it('is stable, so opening a doc and saving it changes nothing', () => {
    const text = save(load('<!-- crew:cols 200 90 -->\n\n| a | b |\n| --- | --- |\n| c | d |\n'))
    expect(save(load(text))).toBe(text)
  })

  it('keeps a centred and a right aligned column', () => {
    const rows = only(load('| a | b | c |\n|:---:|---:|---|\n| d | e | f |\n')).content.rows
    expect(rows[0].cells.map((cell: any) => cell.props.textAlignment)).toEqual(['center', 'right', 'left'])
  })

  it('does not strip alignment from a doc nobody edited', () => {
    const text = save(load('| a | b |\n|:---:|---:|\n| c | d |\n'))
    const rows = only(load(text)).content.rows
    expect(rows[1].cells.map((cell: any) => cell.props.textAlignment)).toEqual(['center', 'right'])
  })

  it('keeps a line break in a cell rather than breaking the table open', () => {
    const back = load('| a | b |\n| --- | --- |\n| one<br>two | d |\n')
    expect(back.document.find((block: any) => block.type === 'table').content.rows.length).toBe(2)
    const again = load(save(back))
    expect(only(again).content.rows.length).toBe(2)
    expect(JSON.stringify(only(again).content.rows[1])).toContain('two')
  })

  it('writes no mark and no colon for a table nobody touched', () => {
    const text = save(load('| a | b |\n| --- | --- |\n| c | d |\n'))
    expect(text).not.toContain('crew:cols')
    expect(text).not.toContain(':--')
  })
})
