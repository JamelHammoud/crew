// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

const root = process.cwd()
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')
const composer = readFileSync(path.join(root, 'src/renderer/src/components/Composer.tsx'), 'utf8')

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
Element.prototype.scrollIntoView = () => {}

const { BlockNoteContext } = await import('@blocknote/react')
const { default: DocEditor } = await import('../src/renderer/src/components/DocEditor')
const { DocEmojiMenu, docEmojiItems } = await import('../src/renderer/src/components/doc/DocEmojiMenu')
const { docSchema } = await import('../src/renderer/src/components/doc/docSchema')
const { BlockNoteEditor } = await import('@blocknote/core')

const doc = (text: string) => render(createElement(DocEditor, { text, onChange: () => {} })).container

describe('emoji in a doc', () => {
  it('paints the sheet over the character it was written as', () => {
    const container = doc('a party 🎉 here')
    const drawn = container.querySelector<HTMLElement>('.doc-emoji')
    expect(drawn).toBeTruthy()
    expect(drawn?.textContent).toBe('🎉')
    expect(drawn?.style.getPropertyValue('--doc-emoji-image')).toContain('url(')
    expect(drawn?.style.getPropertyValue('--doc-emoji-at')).toMatch(/%/)
    expect(container.textContent).toContain('🎉')
  })

  it('leaves code quoted as it was written', () => {
    expect(doc('a party `🎉` here').querySelector('.doc-emoji')).toBeNull()
    expect(doc('```\n🎉\n```').querySelector('.doc-emoji')).toBeNull()
  })

  it('draws every picture in a line and none of the words', () => {
    const drawn = doc('🎉 one 🌱 two 🎉').querySelectorAll('.doc-emoji')
    expect([...drawn].map(one => one.textContent)).toEqual(['🎉', '🌱', '🎉'])
  })
})

// A caret is drawn against the edge of the character beside it and runs the
// height of the line, so anything the app paints over an emoji decides whether
// that caret can be seen. Held to the character's own square it is met above and
// below the picture; a pixel wider, or as tall as the line, and it is gone
// outright, which reads as a box nothing can be typed into. No suite can see a
// caret, so what is held here is the rule that decides it.
describe('a picture over a character takes the room the character takes', () => {
  const rule = () => {
    const at = styles.indexOf('.doc .doc-emoji::after')
    expect(at).toBeGreaterThan(-1)
    return styles.slice(at, styles.indexOf('\n}', at))
  }

  it('draws the doc sheet as a square of the character box', () => {
    expect(rule()).toContain('aspect-ratio: 1')
    expect(rule()).toContain('left: 0')
    expect(rule()).toContain('right: 0')
  })

  it('never draws the doc sheet wider or taller than that', () => {
    expect(rule()).not.toMatch(/(width|height):\s*[\d.]+em/)
    expect(rule()).not.toMatch(/(top|bottom):\s*0/)
  })

  it('keeps the composer patch off the line it stands in', () => {
    const at = composer.indexOf('absolute inset-x-0')
    expect(at).toBeGreaterThan(-1)
    expect(composer.slice(at, composer.indexOf('>', at))).toContain('aspect-square')
    expect(composer).not.toContain('inset-y-0 -inset-x-px')
  })
})

describe('the doc emoji menu', () => {
  const stand = (query: string, onItemClick: (item: unknown) => void, selectedIndex = 0) => {
    const editor = BlockNoteEditor.create({ schema: docSchema as never })
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    editor.mount(mount)
    const items = docEmojiItems(editor as never, query)
    render(
      createElement(
        BlockNoteContext.Provider,
        { value: { editor: editor as never } },
        createElement(DocEmojiMenu, {
          items,
          selectedIndex,
          loadingState: 'loaded',
          onItemClick: onItemClick as never
        } as never)
      )
    )
    return { editor, items }
  }

  it('takes the one standing under the pointer when Tab is pressed', () => {
    const took = vi.fn()
    const { editor, items } = stand('tada', took)
    fireEvent.keyDown(editor.domElement as HTMLElement, { key: 'Tab' })
    expect(took).toHaveBeenCalledTimes(1)
    expect(took.mock.calls[0][0]).toBe(items[0])
  })

  it('takes the one somebody moved to rather than always the first', () => {
    const took = vi.fn()
    const { editor, items } = stand('smil', took, 1)
    expect(items.length).toBeGreaterThan(1)
    fireEvent.keyDown(editor.domElement as HTMLElement, { key: 'Tab' })
    expect(took.mock.calls[0][0]).toBe(items[1])
  })

  it('leaves a Tab alone where there is nothing to take', () => {
    const took = vi.fn()
    const { editor } = stand('zzzzqqqq', took)
    fireEvent.keyDown(editor.domElement as HTMLElement, { key: 'Tab' })
    expect(took).not.toHaveBeenCalled()
  })

  it('leaves Shift and the modifiers to the editor', () => {
    const took = vi.fn()
    const { editor } = stand('tada', took)
    fireEvent.keyDown(editor.domElement as HTMLElement, { key: 'Tab', shiftKey: true })
    expect(took).not.toHaveBeenCalled()
  })
})
