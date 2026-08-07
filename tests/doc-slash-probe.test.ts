// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
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
Element.prototype.scrollIntoView = () => {}

const { BlockNoteContext } = await import('@blocknote/react')
const { DocSlashMenu, docSlashItems, slashMatches } = await import('../src/renderer/src/components/doc/DocSlashMenu')
const { docSchema } = await import('../src/renderer/src/components/doc/docSchema')
const { BlockNoteEditor } = await import('@blocknote/core')

const stand = (query: string, onItemClick: (item: unknown) => void, selectedIndex = 0) => {
  const editor = BlockNoteEditor.create({ schema: docSchema as never })
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  editor.mount(mount)
  const items = slashMatches(docSlashItems(editor as never, () => {}), query)
  render(
    createElement(
      BlockNoteContext.Provider,
      { value: { editor: editor as never } },
      createElement(DocSlashMenu, {
        items,
        selectedIndex,
        loadingState: 'loaded',
        onItemClick: onItemClick as never
      } as never)
    )
  )
  return { editor, items }
}

const titles = (query: string) => {
  const editor = BlockNoteEditor.create({ schema: docSchema as never })
  return slashMatches(docSlashItems(editor as never, () => {}), query).map(item => item.title)
}

describe('the doc slash menu', () => {
  it('takes the one standing under the pointer when Tab is pressed', () => {
    const took = vi.fn()
    const { editor, items } = stand('ta', took)
    fireEvent.keyDown(editor.domElement as HTMLElement, { key: 'Tab' })
    expect(took).toHaveBeenCalledTimes(1)
    expect(took.mock.calls[0][0]).toBe(items[0])
    expect((took.mock.calls[0][0] as { title: string }).title).toBe('Table')
  })

  it('takes the one somebody moved to rather than always the first', () => {
    const took = vi.fn()
    const { editor, items } = stand('list', took, 1)
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
    const { editor } = stand('ta', took)
    fireEvent.keyDown(editor.domElement as HTMLElement, { key: 'Tab', shiftKey: true })
    fireEvent.keyDown(editor.domElement as HTMLElement, { key: 'Tab', metaKey: true })
    expect(took).not.toHaveBeenCalled()
  })
})

describe('what the slash menu matches', () => {
  it('stands the one that starts with what was typed at the top', () => {
    expect(titles('ta')[0]).toBe('Table')
    expect(titles('ta')).toContain('To-do list')
    expect(titles('co')[0]).toBe('Code')
    expect(titles('qu')[0]).toBe('Quote')
  })

  it('takes the whole name over a name it is only part of', () => {
    expect(titles('table')[0]).toBe('Table')
    expect(titles('h1')[0]).toBe('Heading 1')
    expect(titles('todo')[0]).toBe('To-do list')
  })

  it('keeps a group together rather than splitting it down the list', () => {
    for (const query of ['ta', 't', 'list', 'e', 'o']) {
      const groups: string[] = []
      const editor = BlockNoteEditor.create({ schema: docSchema as never })
      for (const item of slashMatches(docSlashItems(editor as never, () => {}), query)) {
        if (groups.at(-1) !== item.group) groups.push(item.group)
      }
      expect(new Set(groups).size, query).toBe(groups.length)
    }
  })

  it('offers everything there is when nothing has been typed', () => {
    expect(titles('')).toEqual(titles(''))
    expect(titles('').length).toBeGreaterThan(10)
    expect(titles('zzzzqqqq')).toEqual([])
  })
})
