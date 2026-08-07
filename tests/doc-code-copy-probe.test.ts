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
  it('stands a mark beside the language, carrying no word of its own', async () => {
    const { container } = render(createElement(DocEditor, { text: DOC, onChange: () => {} }))
    await settle()
    const block = container.querySelector('[data-content-type="codeBlock"]') as HTMLElement
    expect(block).toBeTruthy()

    const slot = block.querySelector('.doc-code-copy') as HTMLElement
    expect(slot).toBeTruthy()
    expect(slot.previousElementSibling?.tagName).toBe('SELECT')

    const button = slot.querySelector('button') as HTMLButtonElement
    expect(button).toBeTruthy()
    expect(button.querySelector('svg')).toBeTruthy()
    expect(button.textContent).toBe('')
  })

  it('copies what the block holds at the moment it is pressed', async () => {
    written.length = 0
    const { container } = render(createElement(DocEditor, { text: DOC, onChange: () => {} }))
    await settle()
    const block = container.querySelector('[data-content-type="codeBlock"]') as HTMLElement
    const button = block.querySelector('.doc-code-copy button') as HTMLButtonElement

    button.click()
    await settle()
    expect(written).toEqual([CODE])

    const code = block.querySelector('code') ?? (block.querySelector('pre') as HTMLElement)
    code.textContent = 'const three = 3'
    button.click()
    await settle()
    expect(written).toEqual([CODE, 'const three = 3'])
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
