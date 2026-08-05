// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { EditorContext, createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas'
import { Editor } from '../src/renderer/src/canvas/editor'
import {
  ArrowShapeTool,
  DrawShapeTool,
  EraserTool,
  FrameShapeTool,
  HandTool,
  HighlightShapeTool,
  LineShapeTool,
  NoteShapeTool,
  SelectTool,
  TextShapeTool
} from '../src/renderer/src/canvas/tools'
import { DesignNodeTool } from '../src/renderer/src/design/DesignNodeTool'
import { designShapeUtils } from '../src/renderer/src/design/shapeUtils'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const { default: DesignLeftPanel } = await import('../src/renderer/src/components/DesignLeftPanel')
const { default: DesignToolbar } = await import('../src/renderer/src/components/DesignToolbar')

function board() {
  const editor = new Editor({
    store: createTLStore({ id: 'panels-live', shapeUtils: designShapeUtils }),
    shapeUtils: designShapeUtils,
    tools: [
      SelectTool,
      HandTool,
      DrawShapeTool,
      HighlightShapeTool,
      EraserTool,
      TextShapeTool,
      NoteShapeTool,
      FrameShapeTool,
      LineShapeTool,
      ArrowShapeTool,
      DesignNodeTool
    ],
    getContainer: () => document.body
  })
  editor.setViewportScreenBounds({ x: 0, y: 0, w: 900, h: 700 })
  return editor
}

function node(editor: Editor, name: string, x: number): TLShapeId {
  const id = createShapeId(name)
  editor.createShape({ id, type: 'design-node', x, y: 0, props: { w: 100, h: 60, name } })
  return id
}

const inside = (editor: Editor, element: ReturnType<typeof createElement>) =>
  render(createElement(EditorContext.Provider, { value: editor }, element))

describe('the design panels on a real board', () => {
  afterEach(cleanup)

  it('lists every layer on the page', () => {
    const editor = board()
    node(editor, 'Card', 0)
    node(editor, 'Label', 200)
    inside(editor, createElement(DesignLeftPanel, { onClose: () => {} }))
    expect(screen.getByText('Card')).toBeTruthy()
    expect(screen.getByText('Label')).toBeTruthy()
  })

  it('picks the shape the layer row names', () => {
    const editor = board()
    const card = node(editor, 'Card', 0)
    node(editor, 'Label', 200)
    inside(editor, createElement(DesignLeftPanel, { onClose: () => {} }))
    fireEvent.click(screen.getByText('Card'))
    expect(editor.getSelectedShapeIds()).toEqual([card])
  })

  it('hides a layer from the row and the canvas together', () => {
    const editor = board()
    const card = node(editor, 'Card', 0)
    inside(editor, createElement(DesignLeftPanel, { onClose: () => {} }))
    fireEvent.click(screen.getByLabelText('Hide'))
    expect(editor.getShape(card)!.meta.hidden).toBe(true)
    expect(editor.isShapeHidden(card)).toBe(true)
  })

  it('locks a layer from the row', () => {
    const editor = board()
    const card = node(editor, 'Card', 0)
    inside(editor, createElement(DesignLeftPanel, { onClose: () => {} }))
    fireEvent.click(screen.getByLabelText('Lock'))
    expect(editor.getShape(card)!.isLocked).toBe(true)
  })

  it('scrolls the layers rather than growing past the panel', () => {
    const editor = board()
    for (let at = 0; at < 60; at += 1) node(editor, `Layer ${at}`, at * 4)
    const view = inside(editor, createElement(DesignLeftPanel, { onClose: () => {} }))
    const scroller = view.container.querySelector('[data-design-layers] .overflow-y-auto') as HTMLElement
    expect(scroller).toBeTruthy()
    expect(scroller.className).toContain('min-h-0')
    let box = scroller.parentElement
    const panel = view.container.querySelector('aside') as HTMLElement
    while (box && box !== panel) {
      expect(box.className, box.className).toContain('flex')
      expect(box.className, box.className).toContain('min-h-0')
      box = box.parentElement
    }
    expect(box).toBe(panel)
    expect(panel.className).toContain('overflow-hidden')
  })

  it('scrolls the inspector the same way', () => {
    const editor = board()
    const card = node(editor, 'Card', 0)
    editor.setSelectedShapes([card])
    const view = inside(editor, createElement(DesignLeftPanel, { onClose: () => {} }))
    const scroller = view.container.querySelector('[data-design-inspector] .overflow-y-auto') as HTMLElement
    expect(scroller).toBeTruthy()
    expect(scroller.className).toContain('min-h-0')
    let box = scroller.parentElement
    const panel = view.container.querySelector('aside') as HTMLElement
    while (box && box !== panel) {
      expect(box.className, box.className).toContain('min-h-0')
      box = box.parentElement
    }
    expect(box).toBe(panel)
  })

  it('turns the layers over for the inspector once something is picked', () => {
    const editor = board()
    const card = node(editor, 'Card', 0)
    const view = inside(editor, createElement(DesignLeftPanel, { onClose: () => {} }))
    const layers = view.container.querySelector('[data-design-layers]') as HTMLElement
    const inspector = view.container.querySelector('[data-design-inspector]') as HTMLElement
    expect(layers.hidden).toBe(false)
    expect(inspector.hidden).toBe(true)
    expect(view.container.querySelector('[aria-label="Layers"]')).toBeTruthy()
    act(() => {
      editor.setSelectedShapes([card])
    })
    expect(view.container.querySelector('[data-design-layers]')).toBe(layers)
    expect(view.container.querySelector('[data-design-inspector]')).toBe(inspector)
    expect(layers.hidden).toBe(true)
    expect(inspector.hidden).toBe(false)
    expect(view.container.querySelector('[aria-label="Design"]')).toBeTruthy()
  })

  it('lines the selection up from the inspector', () => {
    const editor = board()
    const card = node(editor, 'Card', 0)
    const label = node(editor, 'Label', 260)
    editor.setSelectedShapes([card, label])
    inside(editor, createElement(DesignLeftPanel, { onClose: () => {} }))
    fireEvent.click(screen.getByLabelText('Align left'))
    expect(editor.getShape(label)!.x).toBe(editor.getShape(card)!.x)
  })

  it('moves and resizes the one shape from its number fields', () => {
    const editor = board()
    const card = node(editor, 'Card', 0)
    editor.setSelectedShapes([card])
    inside(editor, createElement(DesignLeftPanel, { onClose: () => {} }))
    const x = screen.getByLabelText('X') as HTMLInputElement
    fireEvent.change(x, { target: { value: '48' } })
    fireEvent.blur(x)
    expect(editor.getShape(card)!.x).toBe(48)
    const width = screen.getByLabelText('W') as HTMLInputElement
    fireEvent.change(width, { target: { value: '240' } })
    fireEvent.blur(width)
    expect((editor.getShape(card)!.props as { w: number }).w).toBe(240)
  })

  it('follows the tool the toolbar was clicked on', () => {
    const editor = board()
    inside(editor, createElement(DesignToolbar, { boardId: 'b1', onAsk: () => {}, onRename: () => {}, panels: { left: true, right: true }, onPanels: () => {} }))
    fireEvent.click(screen.getByLabelText('Frame'))
    expect(editor.getCurrentToolId()).toBe('frame')
    expect(screen.getByLabelText('Frame').getAttribute('aria-pressed')).toBe('true')
  })

  it('takes the letter each tool names', () => {
    const editor = board()
    inside(editor, createElement(DesignToolbar, { boardId: 'b1', onAsk: () => {}, onRename: () => {}, panels: { left: true, right: true }, onPanels: () => {} }))
    fireEvent.keyDown(window, { key: 'f' })
    expect(editor.getCurrentToolId()).toBe('frame')
    fireEvent.keyDown(window, { key: 't' })
    expect(editor.getCurrentToolId()).toBe('text')
    fireEvent.keyDown(window, { key: 'r' })
    expect(editor.getCurrentToolId()).toBe('design-node')
    fireEvent.keyDown(window, { key: 'v' })
    expect(editor.getCurrentToolId()).toBe('select')
  })

  it('is put away from its own top corner, whichever side of it is showing', () => {
    const editor = board()
    node(editor, 'Card', 0)
    let away = 0
    inside(editor, createElement(DesignLeftPanel, { onClose: () => (away += 1) }))

    const layers = screen.getByLabelText('Layers').querySelector('[data-design-layers]')!
    const hide = screen.getAllByLabelText('Hide panel')
    expect(hide.some(button => layers.contains(button))).toBe(true)

    fireEvent.click(hide.find(button => layers.contains(button))!)
    expect(away).toBe(1)
  })

  it('keeps that corner once a shape is picked and the panel turns over', () => {
    const editor = board()
    const card = node(editor, 'Card', 0)
    let away = 0
    inside(editor, createElement(DesignLeftPanel, { onClose: () => (away += 1) }))

    act(() => editor.select(card))
    const inspector = document.querySelector('[data-design-inspector]')!
    const hide = screen.getAllByLabelText('Hide panel').find(button => inspector.contains(button))!

    fireEvent.click(hide)
    expect(away).toBe(1)
  })
})
