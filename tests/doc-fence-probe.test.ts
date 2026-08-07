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
const { docSchema } = await import('../src/renderer/src/components/doc/docSchema')

function stand() {
  const editor = BlockNoteEditor.create({ schema: docSchema as never })
  const box = document.createElement('div')
  document.body.append(box)
  editor.mount(box)
  return editor as never as {
    document: Array<{ type: string; props: Record<string, unknown> }>
    prosemirrorView: EditorView
    unmount: () => void
  }
}

function type(view: EditorView, text: string) {
  for (const ch of text) {
    const { from, to } = view.state.selection
    const took = view.someProp('handleTextInput', run => run(view, from, to, ch))
    if (!took) view.dispatch(view.state.tr.insertText(ch, from, to))
  }
}

function enter(view: EditorView) {
  const event = new KeyboardEvent('keydown', { key: 'Enter' })
  view.someProp('handleKeyDown', run => run(view, event))
}

describe('doc fence', () => {
  it('reports what a fence does today', () => {
    const withSpace = stand()
    type(withSpace.prosemirrorView, '``` ')
    console.log('space:', JSON.stringify(withSpace.document.map(b => b.type)))

    const withEnter = stand()
    type(withEnter.prosemirrorView, '```')
    enter(withEnter.prosemirrorView)
    console.log('enter:', JSON.stringify(withEnter.document.map(b => b.type)))

    const withLang = stand()
    type(withLang.prosemirrorView, '```ts ')
    console.log('lang:', JSON.stringify(withLang.document.map(b => [b.type, b.props.language])))

    expect(true).toBe(true)
  })
})
