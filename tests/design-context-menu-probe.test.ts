// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { EditorContext } from '../src/renderer/src/canvas'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil, GroupShapeUtil, defaultBindingUtils } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'
import { nodeDefaults } from '../src/shared/designNode'
import { fakeBoard, type FakeShape } from './helpers/design-editor'

const { default: DesignContextMenu, useContextMenu } = await import('../src/renderer/src/components/DesignContextMenu')

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

const rows = () => [...document.querySelectorAll('button')].map(el => el.textContent ?? '')

const resize = (height: number) =>
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true, configurable: true })

describe('design right click menu', () => {
  afterEach(() => {
    cleanup()
    resize(768)
  })

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
      expect(
        shown.some(row => row.startsWith(label)),
        label
      ).toBe(true)
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

  it('stops growing and scrolls instead of running off the bottom of the screen', () => {
    open([node('shape:a', 'Card')], ['shape:a'])
    const shell = document.querySelector('.glass') as HTMLElement
    expect(shell.style.maxHeight).toBe('420px')
    expect(shell.style.overflowY).toBe('auto')
    expect(rows().length).toBeGreaterThan(12)
  })

  it('never stands taller than the window it is in', () => {
    resize(320)
    open([node('shape:a', 'Card')], ['shape:a'])
    expect((document.querySelector('.glass') as HTMLElement).style.maxHeight).toBe('304px')
  })

  it('keeps the dividers running edge to edge in the part that scrolls', () => {
    open([node('shape:a', 'Card')], ['shape:a'])
    const shell = document.querySelector('.glass') as HTMLElement
    expect(shell.className).toContain('p-1.5')
    for (const line of shell.querySelectorAll('.h-px')) expect(line.className).toContain('-mx-1.5')
  })

  it('caps the layers it lists under the pointer the same way', () => {
    open([node('shape:a', 'Card'), node('shape:b', 'Label')], ['shape:b'])
    fireEvent.pointerEnter(screen.getByText('Select layer').parentElement!)
    const shells = [...document.querySelectorAll('.glass')] as HTMLElement[]
    expect(shells.length).toBe(2)
    for (const shell of shells) expect(shell.style.maxHeight).toBe('420px')
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

function board(): { subject: Editor; container: HTMLDivElement } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const subject = new Editor({
    store: createTLStore({ id: 'context-menu-probe' }),
    shapeUtils: [GeoShapeUtil, GroupShapeUtil],
    bindingUtils: defaultBindingUtils,
    tools: [SelectTool],
    getContainer: () => container
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 1000, h: 800 })
  return { subject, container }
}

function grouped(subject: Editor): TLShapeId {
  for (const [name, x] of [
    ['one', 0],
    ['two', 200]
  ] as const) {
    subject.createShape({ id: createShapeId(name), type: 'geo', x, y: 0, props: { w: 100, h: 100, fill: 'solid' } })
  }
  subject.groupShapes([createShapeId('one'), createShapeId('two')])
  const group = subject.getSelectedShapeIds()[0]
  subject.selectNone()
  return group
}

function rightClick(subject: Editor, container: HTMLElement, x: number, y: number): void {
  const point = { x, y }
  subject.dispatch({
    name: 'right_click',
    target: 'canvas',
    point,
    screenPoint: point,
    phase: 'down',
    button: 2,
    buttons: 2,
    pointerId: 1,
    pointerType: 'mouse',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    accelKey: false
  } as never)
  container.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: x, clientY: y })
  )
}

function listen(subject: Editor): void {
  function Probe() {
    useContextMenu(subject)
    return null
  }
  render(createElement(Probe))
}

describe('right clicking over the real container', () => {
  afterEach(cleanup)

  it('leaves the group the select tool settled on selected', () => {
    const { subject, container } = board()
    const group = grouped(subject)
    subject.select(group)
    listen(subject)
    rightClick(subject, container, 50, 50)
    expect(subject.getSelectedShapeIds()).toEqual([group])
    expect(subject.getSelectedShapes()[0].type).toBe('group')
  })

  it('reaches the group from nothing selected', () => {
    const { subject, container } = board()
    const group = grouped(subject)
    listen(subject)
    rightClick(subject, container, 50, 50)
    expect(subject.getSelectedShapeIds()).toEqual([group])
  })
})
