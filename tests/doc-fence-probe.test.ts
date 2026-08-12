// @vitest-environment jsdom
import type { EditorView } from '@tiptap/pm/view'
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
const { docEmoji } = await import('../src/renderer/src/components/doc/docEmoji')
const { docFence } = await import('../src/renderer/src/components/doc/docFence')
const { docDictionary, docSchema } = await import('../src/renderer/src/components/doc/docSchema')

type Block = { type: string; props: Record<string, unknown>; content: unknown }

function stand() {
  const editor = BlockNoteEditor.create({
    schema: docSchema as never,
    dictionary: docDictionary as never,
    extensions: [docEmoji, docFence] as never,
    tables: { headers: true }
  })
  const box = document.createElement('div')
  document.body.append(box)
  editor.mount(box)
  return editor as never as {
    document: Block[]
    prosemirrorView: EditorView
    blocksToMarkdownLossy: (blocks: unknown[]) => string
    replaceBlocks: (a: unknown[], b: unknown[]) => void
  }
}

function type(view: EditorView, text: string) {
  for (const ch of text) {
    const { from, to } = view.state.selection
    const insert = () => view.state.tr.insertText(ch, from, to)
    const took = view.someProp('handleTextInput', run => run(view, from, to, ch, insert))
    if (!took) view.dispatch(insert())
  }
}

const text = (block: Block) => ((block.content ?? []) as Array<{ text?: string }>).map(part => part.text ?? '').join('')

describe('doc fence', () => {
  it('starts a code block on the third backtick', () => {
    const doc = stand()
    type(doc.prosemirrorView, '```')
    expect(doc.document.map(block => block.type)).toEqual(['codeBlock'])
    expect(text(doc.document[0])).toBe('')
  })

  it('keeps typing inside the block it opened', () => {
    const doc = stand()
    type(doc.prosemirrorView, '```const a = 1')
    expect(doc.document.map(block => block.type)).toEqual(['codeBlock'])
    expect(text(doc.document[0])).toBe('const a = 1')
    expect(doc.blocksToMarkdownLossy(doc.document)).toContain('```text\nconst a = 1\n```')
  })

  it('reads a language off the block rather than off what follows the backticks', () => {
    const doc = stand()
    type(doc.prosemirrorView, '```ts')
    expect(doc.document[0].props.language).toBe('text')
    expect(text(doc.document[0])).toBe('ts')
  })

  it('leaves backticks written inside a sentence alone', () => {
    const doc = stand()
    type(doc.prosemirrorView, 'write ``` for code')
    expect(doc.document.map(block => block.type)).toEqual(['paragraph'])
    expect(text(doc.document[0])).toBe('write ``` for code')
  })

  it('leaves backticks written inside a code block alone', () => {
    const doc = stand()
    type(doc.prosemirrorView, '```')
    type(doc.prosemirrorView, '```')
    expect(doc.document.map(block => block.type)).toEqual(['codeBlock'])
    expect(text(doc.document[0])).toBe('```')
  })
})
