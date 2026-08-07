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

describe('repro', () => {
  it('paints the select', () => {
    for (const written of ['bash', 'ts', 'py', 'yml', 'sh', 'typescript', 'text', 'nonsense']) {
      const editor = BlockNoteEditor.create({ schema: docSchema as never }) as never as {
        document: unknown[]
        replaceBlocks: (a: unknown[], b: unknown[]) => void
        tryParseMarkdownToBlocks: (markdown: string) => unknown[]
        mount: (el: HTMLElement) => void
      }
      const host = document.createElement('div')
      document.body.append(host)
      editor.mount(host)
      editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(`\`\`\`${written}\nx\n\`\`\`\n`))
      const select = host.querySelector('select') as HTMLSelectElement | null
      console.log(written, '-> value', JSON.stringify(select?.value), 'index', select?.selectedIndex, 'text', JSON.stringify(select?.selectedOptions?.[0]?.text))
    }
    expect(true).toBe(true)
  })
})
