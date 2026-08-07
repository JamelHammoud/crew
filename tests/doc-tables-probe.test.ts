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

  it('loses a column width, so the drag is the session own and never the file', () => {
    expect(roundTrip({ headerRows: 1, columnWidths: [200, 90] }).columnWidths).toEqual([undefined, undefined])
  })
})
