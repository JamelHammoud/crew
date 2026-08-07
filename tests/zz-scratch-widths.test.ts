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
  it('parses a comment with no blank line', () => {
    const two = editor()
    const md = 'intro\n\n<!-- crew:cols 200 90 -->\n| a | b |\n| --- | --- |\n| c | d |\n\nafter\n'
    const blocks = two.tryParseMarkdownToBlocks(md)
    console.log('TYPES>>>' + blocks.map((b: any) => b.type).join(',') + '<<<')
    console.log('WIDTHS>>>' + JSON.stringify(blocks.find((b: any) => b.type === 'table')?.content?.columnWidths) + '<<<')
    expect(1).toBe(1)
  })

  it('accepts widths set back onto a parsed table', () => {
    const two = editor()
    const blocks = two.tryParseMarkdownToBlocks('| a | b |\n| --- | --- |\n| c | d |\n')
    ;(blocks[0] as any).content.columnWidths = [200, 90]
    two.replaceBlocks(two.document, blocks)
    console.log('AFTER>>>' + JSON.stringify(two.document[0].content.columnWidths) + '<<<')
    console.log('REMD>>>\n' + two.blocksToMarkdownLossy(two.document) + '<<<')
    expect(1).toBe(1)
  })
})
