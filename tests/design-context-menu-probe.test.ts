// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { EditorContext } from 'tldraw'
import { nodeDefaults } from '../src/shared/designNode'
import { fakeBoard, type FakeShape } from './helpers/design-editor'

const { default: DesignContextMenu } = await import('../src/renderer/src/components/DesignContextMenu')

const node = (id: string, name: string): FakeShape => ({
  id,
  type: 'design-node',
  parentId: 'page:main',
  props: { ...nodeDefaults(), name }
})

const SPOT = { screen: { x: 120, y: 90 }, page: { x: 40, y: 60 } }

function open(list: FakeShape[], selected: string[], extra: Record<string, unknown> = {}) {
  const made = fakeBoard(list)
  made.select(...selected)
  const view = render(
    createElement(
      EditorContext.Provider,
      { value: made.editor },
      createElement(DesignContextMenu, {
        spot: SPOT,
        onClose: () => {},
        onAsk: () => {},
        onRename: () => {},
        ...extra
      } as never)
    )
  )
  return { ...made, view }
}

const rows = () => [...document.querySelectorAll('[role="button"], button')].map(el => el.textContent ?? '')

describe('design right click menu', () => {
  it('opens on the selection with the actions Figma puts there', () => {
    open([node('shape:a', 'Card'), node('shape:b', 'Label')], ['shape:a', 'shape:b'])
    const shown = rows()
    for (const label of [
      'Ask an agent',
      'Duplicate',
      'Bring to front',
      'Send to back',
      'Group selection',
      'Frame selection',
      'Use as mask',
      'Flip horizontal',
      'Lock',
      'Hide',
      'Delete'
    ]) {
      expect(shown.some(row => row.startsWith(label)), label).toBe(true)
    }
  })

  it('shows the canvas actions when nothing is picked, and none of the rest', () => {
    open([node('shape:a', 'Card')], [])
    const shown = rows()
    expect(shown.some(row => row.startsWith('Select all'))).toBe(true)
    expect(shown.some(row => row.startsWith('Zoom to fit'))).toBe(true)
    expect(shown.some(row => row.startsWith('Delete'))).toBe(false)
    expect(shown.some(row => row.startsWith('Ask an agent'))).toBe(false)
  })

  it('hands Ask an agent to the ask bar rather than running it here', () => {
    let asked = 0
    open([node('shape:a', 'Card')], ['shape:a'], { onAsk: () => (asked += 1) })
    fireEvent.click(screen.getByText('Ask an agent'))
    expect(asked).toBe(1)
  })

  it('carries the shortcut beside the row', () => {
    open([node('shape:a', 'Card')], ['shape:a'])
    const shown = rows()
    expect(shown.find(row => row.startsWith('Duplicate'))).toContain('⌘D')
    expect(shown.find(row => row.startsWith('Lock'))).toContain('⇧⌘L')
  })

  it('lets you reach a layer buried under the one on top', () => {
    open([node('shape:a', 'Card'), node('shape:b', 'Label')], ['shape:b'])
    const layers = screen.getByText('Select layer')
    fireEvent.pointerEnter(layers.parentElement!)
    expect(screen.getByText('Card')).toBeTruthy()
    expect(screen.getByText('Label')).toBeTruthy()
  })

  it('picks the layer it is handed', () => {
    const made = open([node('shape:a', 'Card'), node('shape:b', 'Label')], ['shape:b'])
    fireEvent.pointerEnter(screen.getByText('Select layer').parentElement!)
    fireEvent.click(screen.getByText('Card'))
    expect(made.calls).toContain('select(shape:a)')
  })

  it('runs what it is clicked on', () => {
    const made = open([node('shape:a', 'Card')], ['shape:a'])
    fireEvent.click(screen.getByText('Bring to front'))
    expect(made.calls).toContain('bringToFront(shape:a)')
  })

  it('draws nothing at all until it is opened', () => {
    const made = fakeBoard([node('shape:a', 'Card')])
    const { container } = render(
      createElement(
        EditorContext.Provider,
        { value: made.editor },
        createElement(DesignContextMenu, {
          spot: null,
          onClose: () => {},
          onAsk: () => {},
          onRename: () => {}
        } as never)
      )
    )
    expect(container.textContent).toBe('')
  })
})
