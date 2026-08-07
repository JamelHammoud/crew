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

describe('shape', () => {
  it('dumps a plain two by two', () => {
    const one = editor()
    one.replaceBlocks(one.document, [
      {
        type: 'table',
        content: {
          type: 'tableContent',
          headerRows: 1,
          rows: [{ cells: ['a', 'b'] }, { cells: ['c', 'd'] }]
        }
      } as never
    ])
    console.log('DOC ---', JSON.stringify(one.document, null, 2))
    const md = one.blocksToMarkdownLossy(one.document)
    console.log('MD ---', JSON.stringify(md))
    expect(md).toBeTruthy()
  })
})
