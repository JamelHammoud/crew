// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
window.matchMedia = ((q: string) => ({ matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
const { BlockNoteEditor } = await import('@blocknote/core')
const { docSchema } = await import('/Users/jamel/Documents/Repositories/crew/src/renderer/src/components/doc/docSchema')

const make = (tables?: Record<string, boolean>) =>
  BlockNoteEditor.create({ schema: docSchema as never, tables } as never) as never as {
    document: never[]
    replaceBlocks: (a: unknown[], b: unknown[]) => void
    blocksToMarkdownLossy: (b: unknown[]) => string
    tryParseMarkdownToBlocks: (m: string) => unknown[]
    settings: { tables: Record<string, boolean> }
  }

const table = (headerRows?: number, headerCols?: number) => ({
  type: 'table',
  content: {
    type: 'tableContent',
    headerRows,
    headerCols,
    rows: [
      { cells: ['Block', 'Group'] },
      { cells: ['Heading', 'Text'] },
      { cells: ['Code', 'Blocks'] }
    ]
  }
})

describe('table headers', () => {
  it('says what the settings default to', () => {
    console.log('DEFAULT SETTINGS', JSON.stringify(make().settings.tables))
    console.log('OPTED IN', JSON.stringify(make({ headers: true }).settings.tables))
  })
  it('round trips a header row', () => {
    const one = make({ headers: true })
    one.replaceBlocks(one.document, [table(1) as never])
    const md = one.blocksToMarkdownLossy(one.document)
    console.log('HEADER ROW MD:\n' + md)
    const back = make({ headers: true })
    back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(md))
    console.log('BACK', JSON.stringify((back.document[0] as never as { content: unknown }).content))
  })
  it('round trips a header column', () => {
    const one = make({ headers: true })
    one.replaceBlocks(one.document, [table(undefined, 1) as never])
    const md = one.blocksToMarkdownLossy(one.document)
    console.log('HEADER COL MD:\n' + md)
    const back = make({ headers: true })
    back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(md))
    console.log('BACK', JSON.stringify((back.document[0] as never as { content: unknown }).content))
  })
  it('round trips a plain table', () => {
    const one = make({ headers: true })
    one.replaceBlocks(one.document, [table() as never])
    const md = one.blocksToMarkdownLossy(one.document)
    console.log('PLAIN MD:\n' + md)
    const back = make({ headers: true })
    back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(md))
    console.log('BACK', JSON.stringify((back.document[0] as never as { content: unknown }).content))
  })
})
