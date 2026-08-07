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

const settle = (ms: number) => new Promise(done => setTimeout(done, ms))

describe('repro', () => {
  it('highlights an alias block', async () => {
    for (const written of ['bash', 'shellscript', 'ts']) {
      const editor = BlockNoteEditor.create({ schema: docSchema as never }) as never as {
        document: unknown[]
        replaceBlocks: (a: unknown[], b: unknown[]) => void
        tryParseMarkdownToBlocks: (markdown: string) => unknown[]
        mount: (el: HTMLElement) => void
      }
      const host = document.createElement('div')
      document.body.append(host)
      editor.mount(host)
      const code = written === 'ts' ? 'const one = 1' : 'echo "hi" | grep hi'
      editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(`\`\`\`${written}\n${code}\n\`\`\`\n`))
      await settle(600)
      const el = host.querySelector('[data-content-type="codeBlock"] code') as HTMLElement
      console.log(written, '-> spans', el?.querySelectorAll('span').length, JSON.stringify(el?.innerHTML?.slice(0, 160)))
    }
    expect(true).toBe(true)
  }, 20000)
})
