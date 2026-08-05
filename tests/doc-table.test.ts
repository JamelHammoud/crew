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
const { DOC_BLOCKS } = await import('../src/renderer/src/components/doc/docBlocks')
const { docSchema } = await import('../src/renderer/src/components/doc/docSchema')

interface Probe {
  document: unknown[]
  replaceBlocks: (a: unknown[], b: unknown[]) => void
  blocksToMarkdownLossy: (blocks: unknown[]) => string
  tryParseMarkdownToBlocks: (markdown: string) => unknown[]
  settings: { tables: { headers: boolean } }
}

const editor = (): Probe =>
  BlockNoteEditor.create({ schema: docSchema as never, tables: { headers: true } } as never) as never as Probe

const table = (headerRows?: number, headerCols?: number) => ({
  type: 'table',
  content: {
    type: 'tableContent',
    headerRows,
    headerCols,
    rows: [{ cells: ['Block', 'Group'] }, { cells: ['Heading', 'Text'] }, { cells: ['Code', 'Blocks'] }]
  }
})

interface Content {
  headerRows?: number
  headerCols?: number
  rows: unknown[]
}

const roundTrip = (block: unknown): { markdown: string; content: Content } => {
  const one = editor()
  one.replaceBlocks(one.document, [block])
  const markdown = one.blocksToMarkdownLossy(one.document)
  const back = editor()
  back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(markdown))
  return { markdown, content: (back.document[0] as { content: Content }).content }
}

describe('a table in a doc', () => {
  it('is offered with a header row already on it', () => {
    const content = DOC_BLOCKS.find(one => one.key === 'table')?.block.content as Content | undefined
    expect(content?.headerRows).toBe(1)
  })

  it('keeps that header row through a markdown round trip', () => {
    const { markdown, content } = roundTrip(table(1))
    expect(markdown.split('\n')[0]).toContain('Block')
    expect(content.headerRows).toBe(1)
    expect(content.rows).toHaveLength(3)
  })

  it('writes no blank row at the head of the file', () => {
    const { markdown } = roundTrip(table(1))
    expect(markdown.split('\n')[0].replace(/[|\s]/g, '')).not.toBe('')
  })

  it('leaves a table with no header row a row short of what it was', () => {
    const { markdown } = roundTrip(table())
    expect(markdown.split('\n')[0].replace(/[|\s]/g, '')).toBe('')
  })

  it('loses a header column, which is why one is never written down', () => {
    const { content } = roundTrip(table(1, 1))
    expect(content.headerRows).toBe(1)
    expect(content.headerCols).toBeUndefined()
  })

  it('is built with the header setting the menu row hangs off', () => {
    expect(editor().settings.tables.headers).toBe(true)
  })
})
