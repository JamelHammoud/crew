// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

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

const written: string[] = []
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: (text: string) => {
      written.push(text)
      return Promise.resolve()
    }
  }
})

const { default: DocEditor } = await import('../src/renderer/src/components/DocEditor')
const { BlockNoteEditor } = await import('@blocknote/core')
const { docSchema } = await import('../src/renderer/src/components/doc/docSchema')

const CODE = 'const one = 1\nconst two = 2'
const DOC = `Words\n\n\`\`\`ts\n${CODE}\n\`\`\`\n`

const settle = () => new Promise(done => setTimeout(done, 0))

describe('copying a code block', () => {
  it('stands a copy button beside the language, and copies what the block holds', async () => {
    const { container } = render(createElement(DocEditor, { text: DOC, onChange: () => {} }))
    const block = container.querySelector('[data-content-type="codeBlock"]') as HTMLElement
    expect(block).toBeTruthy()

    const button = block.querySelector('.doc-code-copy') as HTMLButtonElement
    expect(button).toBeTruthy()
    expect(button.textContent).toBe('Copy')
    expect(button.previousElementSibling?.tagName).toBe('SELECT')

    button.click()
    await settle()
    expect(written).toEqual([CODE])
    expect(button.textContent).toBe('Copied')

    await new Promise(done => setTimeout(done, 1300))
    expect(button.textContent).toBe('Copy')
  })

  it('is drawn for the screen and never written into the doc', () => {
    const editor = BlockNoteEditor.create({ schema: docSchema as never }) as never as {
      document: unknown[]
      replaceBlocks: (a: unknown[], b: unknown[]) => void
      blocksToMarkdownLossy: (blocks: unknown[]) => string
      tryParseMarkdownToBlocks: (markdown: string) => unknown[]
    }
    editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(DOC))
    const markdown = editor.blocksToMarkdownLossy(editor.document)
    expect(markdown).toContain(CODE)
    expect(markdown).not.toContain('Copy')
  })
})
