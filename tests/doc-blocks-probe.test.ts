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
const { DOC_BLOCKS, kindOf, shortcutLabel } = await import('../src/renderer/src/components/doc/docBlocks')
const { docSlashItems } = await import('../src/renderer/src/components/doc/DocSlashMenu')
const { docSchema, docDictionary } = await import('../src/renderer/src/components/doc/docSchema')
const { CODE_LANGUAGES } = await import('../src/renderer/src/components/doc/docCode')

const editor = () => BlockNoteEditor.create({ schema: docSchema as never }) as never as {
  document: Array<{ type: string; props: Record<string, unknown> }>
  replaceBlocks: (a: unknown[], b: unknown[]) => void
  insertBlocks: (blocks: unknown[], at: unknown, place: string) => void
  blocksToMarkdownLossy: (blocks: unknown[]) => string
  tryParseMarkdownToBlocks: (markdown: string) => unknown[]
}

describe('doc blocks', () => {
  it('offers a mark, a title and aliases for every block', () => {
    for (const kind of DOC_BLOCKS) {
      expect(kind.title.length, kind.key).toBeGreaterThan(0)
      expect(kind.mark, kind.key).toBeTruthy()
      expect(kind.aliases.length, kind.key).toBeGreaterThan(0)
    }
    expect(new Set(DOC_BLOCKS.map(kind => kind.key)).size).toBe(DOC_BLOCKS.length)
  })

  it('builds slash items the editor can insert', () => {
    const bn = editor()
    const items = docSlashItems(bn as never, () => {})
    expect(items.map(item => item.title)).toEqual(DOC_BLOCKS.map(kind => kind.title))
    for (const kind of DOC_BLOCKS) {
      if (kind.key === 'image') continue
      const one = editor()
      one.replaceBlocks(one.document, [kind.block])
      expect(one.document[0].type, kind.key).toBe(kind.block.type)
    }
  })

  it('keeps every offered block through a markdown round trip', () => {
    for (const kind of DOC_BLOCKS) {
      if (kind.key === 'image' || kind.key === 'divider') continue
      const one = editor()
      one.replaceBlocks(one.document, [{ ...kind.block, content: kind.key === 'table' ? kind.block.content : 'crew' }])
      const markdown = one.blocksToMarkdownLossy(one.document)
      const back = editor()
      back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(markdown))
      expect(back.document[0].type, `${kind.key}: ${markdown}`).toBe(kind.block.type)
    }
  })

  it('names the block a cursor is sitting in', () => {
    for (const kind of DOC_BLOCKS) {
      expect(kindOf({ type: kind.block.type as string, props: kind.block.props })?.key).toBe(kind.key)
    }
    expect(kindOf({ type: 'audio' })).toBeUndefined()
  })

  it('speaks plainly in its placeholders', () => {
    expect(docDictionary.placeholders.default).toContain('/')
    expect(docDictionary.placeholders.emptyDocument).toContain('Write')
    expect(docDictionary.placeholders.heading).toBe('Heading')
  })

  it('highlights code in the languages crew knows, under the names markdown writes', () => {
    expect(CODE_LANGUAGES.typescript.name).toBe('TypeScript')
    expect(CODE_LANGUAGES.typescript.aliases).toContain('ts')
    expect(CODE_LANGUAGES.shellscript.aliases).toContain('bash')
    expect(CODE_LANGUAGES.text.name).toBe('Plain text')
  })

  it('writes shortcuts the way the platform does', () => {
    const label = shortcutLabel('Mod-Alt-1')
    expect(label === '⌘⌥1' || label === 'Ctrl+Alt+1').toBe(true)
  })
})
