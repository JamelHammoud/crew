// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

window.matchMedia = ((query: string) => ({
  matches: false, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {},
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false
})) as typeof window.matchMedia

const { BlockNoteEditor } = await import('@blocknote/core')
const { docSchema } = await import('../src/renderer/src/components/doc/docSchema')

const editor = () => BlockNoteEditor.create({ schema: docSchema as never }) as never as any

describe('probe', () => {
  it('serializes', () => {
    const one = editor()
    one.replaceBlocks(one.document, [
      { type: 'paragraph', content: 'before' },
      { type: 'table', content: { type: 'tableContent', headerRows: 1, columnWidths: [200, 90],
        rows: [{ cells: ['a', 'b'] }, { cells: ['c', 'd'] }] } },
      { type: 'paragraph', content: 'after' }
    ])
    console.log('MARKDOWN>>>\n' + one.blocksToMarkdownLossy(one.document) + '\n<<<END')
    expect(1).toBe(1)
  })

  it('parses a comment', () => {
    const two = editor()
    const md = '<!-- crew:cols 200 90 -->\n\n| a | b |\n| --- | --- |\n| c | d |\n'
    const blocks = two.tryParseMarkdownToBlocks(md)
    console.log('PARSED>>>\n' + JSON.stringify(blocks, null, 1) + '\n<<<END')
    expect(1).toBe(1)
  })
})
