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

const styles = (await import('../src/renderer/src/styles.css?raw')).default as string
const view = (await import('../src/renderer/src/views/Docs.tsx?raw')).default as string
const editorSource = (await import('../src/renderer/src/components/DocEditor.tsx?raw')).default as string

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

const roundTrip = (block: unknown): { markdown: string; content: { headerRows?: number; headerCols?: number; rows: unknown[] } } => {
  const one = editor()
  one.replaceBlocks(one.document, [block])
  const markdown = one.blocksToMarkdownLossy(one.document)
  const back = editor()
  back.replaceBlocks(back.document, back.tryParseMarkdownToBlocks(markdown))
  return { markdown, content: (back.document[0] as { content: never }).content }
}

const rule = (selector: string): string =>
  new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(styles)?.[1] ?? ''

describe('a table in a doc', () => {
  it('is offered with a header row already on it', () => {
    const kind = DOC_BLOCKS.find(one => one.key === 'table')
    const content = kind?.block.content as { headerRows?: number } | undefined
    expect(content?.headerRows).toBe(1)
  })

  it('keeps that header row through a markdown round trip', () => {
    const { markdown, content } = roundTrip(table(1))
    expect(markdown.split('\n')[0]).toContain('Block')
    expect(content.headerRows).toBe(1)
    expect(content.rows).toHaveLength(3)
  })

  it('writes no blank row for a table that has no header', () => {
    const { markdown } = roundTrip(table(1))
    expect(markdown.split('\n')[0].replace(/[|\s]/g, '')).not.toBe('')
  })

  it('loses a header column, which is why one is never written down', () => {
    const { content } = roundTrip(table(1, 1))
    expect(content.headerCols).toBeUndefined()
  })

  it('is drawn as one rounded frame rather than a grid of boxed cells', () => {
    const frame = rule(`.doc .bn-editor \\[data-content-type='table'\\] table`)
    expect(frame).toContain('border-collapse: separate')
    expect(frame).toMatch(/border-radius:\s*12px/)
    expect(frame).toMatch(/border:\s*1px solid/)

    const cells = rule(`.doc .bn-editor \\[data-content-type='table'\\] th,\\s*\\n.doc .bn-editor \\[data-content-type='table'\\] td`)
    expect(cells).toContain('border: none')
    expect(cells).toContain('border-right')
    expect(cells).toContain('border-bottom')
  })

  it('scrolls inside its own box rather than pushing the column sideways', () => {
    const wrapper = rule(`.doc .bn-editor \\[data-content-type='table'\\] .tableWrapper`)
    expect(wrapper).toContain('min-width: 0')
    expect(wrapper).toContain('max-width: 100%')
    expect(view).toContain('overflow-x-hidden')
  })

  it('wears crew colors where blocknote ships its own', () => {
    expect(styles).toContain('.doc .bn-editor .column-resize-handle')
    expect(rule(`.doc .bn-editor \\[data-content-type='table'\\] .selectedCell::after`)).toContain(
      'var(--color-selection)'
    )
  })

  it('stands its menu rows on nothing until they are hovered', () => {
    const row = rule('.doc .bn-container .mantine-Menu-item')
    expect(row).toContain('background: transparent')
    expect(styles).toContain('.doc .bn-container .mantine-Menu-item[data-hovered]')
  })

  it('is built with the header setting the menu row hangs off', () => {
    expect(editor().settings.tables.headers).toBe(true)
    const source = readFileSync(path.join(root, 'src/renderer/src/components/DocEditor.tsx'), 'utf8')
    expect(source).toContain('tables: { headers: true }')
  })
})
