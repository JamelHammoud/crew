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

const table = (extra: Record<string, unknown>) => ({
  type: 'table',
  content: {
    type: 'tableContent',
    ...extra,
    rows: [{ cells: ['a', 'b'] }, { cells: ['c', 'd'] }]
  }
})

describe('scratch', () => {
  it('says what markdown does with headers', () => {
    for (const [name, extra] of Object.entries({
      'header row': { headerRows: 1 },
      'no header': {},
      'header col': { headerCols: 1 },
      'both': { headerRows: 1, headerCols: 1 }
    })) {
      const one = editor()
      one.replaceBlocks(one.document, [table(extra) as never])
      const markdown = one.blocksToMarkdownLossy(one.document)
      const back = editor()
      back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(markdown))
      console.log(`\n--- ${name}`)
      console.log(JSON.stringify(markdown))
      console.log('back:', JSON.stringify(back.document[0]?.content?.headerRows), JSON.stringify(back.document[0]?.content?.headerCols))
      console.log('rows back:', back.document[0]?.content?.rows?.length)
    }
    expect(true).toBe(true)
  })

  it('says what a column width does', () => {
    const one = editor()
    one.replaceBlocks(one.document, [
      { ...table({ headerRows: 1 }), content: { ...table({ headerRows: 1 }).content, columnWidths: [200, 90] } } as never
    ])
    const markdown = one.blocksToMarkdownLossy(one.document)
    const back = editor()
    back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(markdown))
    console.log('\n--- widths')
    console.log(JSON.stringify(markdown))
    console.log('back:', JSON.stringify(back.document[0]?.content?.columnWidths))
    expect(true).toBe(true)
  })
})
