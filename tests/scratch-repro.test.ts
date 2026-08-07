// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
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

const { default: DocEditor } = await import('../src/renderer/src/components/DocEditor')
const { BlockNoteEditor } = await import('@blocknote/core')
const { docSchema } = await import('../src/renderer/src/components/doc/docSchema')

describe('repro', () => {
  it('shows what the props hold', () => {
    const editor = BlockNoteEditor.create({ schema: docSchema as never }) as never as {
      document: Array<{ type: string; props: Record<string, unknown> }>
      replaceBlocks: (a: unknown[], b: unknown[]) => void
      tryParseMarkdownToBlocks: (markdown: string) => unknown[]
      blocksToMarkdownLossy: (blocks: unknown[]) => string
    }
    for (const written of ['bash', 'ts', 'py', 'yml', 'sh', 'zsh', 'typescript', 'shellscript']) {
      const one = BlockNoteEditor.create({ schema: docSchema as never }) as never as typeof editor
      one.replaceBlocks(one.document, one.tryParseMarkdownToBlocks(`\`\`\`${written}\nx\n\`\`\`\n`))
      console.log(written, '->', JSON.stringify(one.document[0]?.props), one.blocksToMarkdownLossy(one.document).split('\n')[0])
    }
  })

  it('shows what the select paints', () => {
    for (const written of ['bash', 'ts', 'typescript']) {
      const { container } = render(
        createElement(DocEditor, { text: `\`\`\`${written}\nx\n\`\`\`\n`, onChange: () => {} })
      )
      const select = container.querySelector('[data-content-type="codeBlock"] select') as HTMLSelectElement
      console.log(written, '-> value', JSON.stringify(select?.value), 'index', select?.selectedIndex)
    }
    expect(true).toBe(true)
  })
})
