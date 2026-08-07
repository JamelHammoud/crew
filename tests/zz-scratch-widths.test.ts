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
const TABLE = '| a | b |\n| --- | --- |\n| c | d |'

const shape = (md: string) => {
  const e = editor()
  const blocks = e.tryParseMarkdownToBlocks(md)
  return blocks.map((b: any) => b.type + (b.content?.rows ? `(${b.content.rows.length})` : '')).join(',')
}

describe('placement', () => {
  it('A comment then blank then table, in context', () => {
    console.log('A>>>' + shape(`intro\n\n<!-- crew:cols 200 90 -->\n\n${TABLE}\n\nafter\n`) + '<<<')
  })
  it('B table then blank then comment', () => {
    console.log('B>>>' + shape(`intro\n\n${TABLE}\n\n<!-- crew:cols 200 90 -->\n\nafter\n`) + '<<<')
  })
  it('C two tables each with a comment', () => {
    console.log('C>>>' + shape(`<!-- crew:cols 200 90 -->\n\n${TABLE}\n\n<!-- crew:cols 50 60 -->\n\n${TABLE}\n`) + '<<<')
  })
  it('D comment straight after a heading', () => {
    console.log('D>>>' + shape(`# Head\n\n<!-- crew:cols 200 90 -->\n\n${TABLE}\n`) + '<<<')
  })
  it('E comment inside a list item followed by a table', () => {
    console.log('E>>>' + shape(`- one\n\n<!-- crew:cols 200 90 -->\n\n${TABLE}\n`) + '<<<')
  })
})
