// @vitest-environment jsdom
import { Editor as TipTapEditor } from '@tiptap/core'
import { render } from '@testing-library/react'
import { StrictMode, createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { richTextExtensions } from '../src/renderer/src/canvas/text/richText'
import { RichTextToolbar } from '../src/renderer/src/canvas/text/toolbar'

const made: TipTapEditor[] = []

function textEditor() {
  const element = document.createElement('div')
  document.body.appendChild(element)
  const editor = new TipTapEditor({
    element,
    extensions: richTextExtensions,
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] }
  })
  made.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of made.splice(0)) if (!editor.isDestroyed) editor.destroy()
  document.body.innerHTML = ''
})

describe('rich text toolbar', () => {
  it('stands down rather than throwing when the editor it was handed is gone', () => {
    const editor = textEditor()
    editor.destroy()
    expect(() => render(createElement(RichTextToolbar, { editor }))).not.toThrow()
  })

  it('survives the double mount the app runs under', () => {
    const editor = textEditor()
    expect(() =>
      render(createElement(StrictMode, null, createElement(RichTextToolbar, { editor })))
    ).not.toThrow()
  })

  it('takes a live editor without reaching for a document of its own', () => {
    const editor = textEditor()
    expect(() => render(createElement(RichTextToolbar, { editor }))).not.toThrow()
    expect(editor.isDestroyed).toBe(false)
  })

  it('takes no editor at all', () => {
    expect(() => render(createElement(RichTextToolbar, { editor: null }))).not.toThrow()
  })
})
