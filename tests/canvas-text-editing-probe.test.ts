import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CrewCanvas } from '../src/renderer/src/canvas/CrewCanvas'
import type { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil, TextShapeUtil } from '../src/renderer/src/canvas/shapes'
import { shapeCssTransform } from '../src/renderer/src/canvas/render'
import { richTextToPlainText, type RichTextDocument } from '../src/renderer/src/canvas/text'

const globalKeys = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLCanvasElement',
  'SVGElement',
  'Element',
  'Node',
  'MutationObserver',
  'ResizeObserver',
  'getSelection',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT'
] as const

const originalGlobals = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const))
const JSDOM = createRequire(import.meta.url)('jsdom').JSDOM as new (
  html: string,
  options: { pretendToBeVisual: boolean }
) => { window: Window & typeof globalThis }

let dom: { window: Window & typeof globalThis }

function setGlobal(key: (typeof globalKeys)[number], value: unknown): void {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}

beforeAll(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
  const view = dom.window
  setGlobal('window', view)
  setGlobal('document', view.document)
  setGlobal('navigator', view.navigator)
  setGlobal('HTMLElement', view.HTMLElement)
  setGlobal('HTMLCanvasElement', view.HTMLCanvasElement)
  setGlobal('SVGElement', view.SVGElement)
  setGlobal('Element', view.Element)
  setGlobal('Node', view.Node)
  setGlobal('MutationObserver', view.MutationObserver)
  setGlobal('getSelection', view.getSelection.bind(view))
  setGlobal('requestAnimationFrame', view.requestAnimationFrame.bind(view))
  setGlobal('cancelAnimationFrame', view.cancelAnimationFrame.bind(view))
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  setGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback([], this as unknown as ResizeObserver)
      }
      disconnect(): void {}
      unobserve(): void {}
    }
  )
  const rect = { x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400, toJSON: () => ({}) }
  Object.defineProperty(view.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => rect })
  Object.defineProperty(view.Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(view.Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => rect })
  Object.defineProperty(view.Element.prototype, 'getClientRects', { configurable: true, value: () => [] })
})

afterAll(() => {
  dom.window.close()
  for (const key of globalKeys) {
    const descriptor = originalGlobals.get(key)
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function drawingContext(): CanvasRenderingContext2D {
  const noop = vi.fn()
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, key) => (key === 'canvas' ? undefined : noop)
  })
}

const textId = createShapeId('probe-text')
const geoId = createShapeId('probe-geo')

const hello: RichTextDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }]
}

function mountBoard(): { view: ReturnType<typeof render>; editor: () => Editor } {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawingContext())
  const store = createTLStore({ id: 'canvas-text-editing-probe' })
  let made: Editor | undefined
  const onMount = (subject: Editor) => {
    made = subject
    subject.createShapes([
      {
        id: textId,
        type: 'text',
        x: 40,
        y: 40,
        props: {
          color: 'black',
          size: 'm',
          w: 120,
          font: 'draw',
          textAlign: 'start',
          autoSize: true,
          scale: 1,
          richText: hello
        }
      },
      {
        id: geoId,
        type: 'geo',
        x: 220,
        y: 40,
        props: { w: 140, h: 90, geo: 'rectangle', richText: hello }
      }
    ])
    return undefined
  }
  const view = render(
    createElement(CrewCanvas, { store, shapeUtils: [TextShapeUtil, GeoShapeUtil], onMount })
  )
  return { view, editor: () => made! }
}

function pointer(type: string, x: number, y: number, buttons: number): MouseEvent {
  const event = new dom.window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, buttons })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'mouse' },
    pressure: { value: buttons ? 0.5 : 0 }
  })
  return event
}

function doubleClick(node: HTMLElement, x: number, y: number): void {
  node.dispatchEvent(pointer('pointerdown', x, y, 1))
  node.dispatchEvent(pointer('pointerup', x, y, 0))
  node.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y }))
}

describe('canvas text editing', () => {
  it('opens a caret on a shape that is already selected', async () => {
    const { view, editor } = mountBoard()
    await waitFor(() => expect(view.container.querySelectorAll('[data-canvas-shape="true"]')).toHaveLength(2))

    act(() => {
      editor().select(textId)
    })
    const bounds = editor().getShapePageBounds(textId)!
    const point = editor().pageToViewport(bounds.center)
    const node = view.container.querySelector(`[data-shape-id="${textId}"]`) as HTMLElement

    act(() => doubleClick(node, point.x, point.y))

    await waitFor(() => expect(editor().getEditingShapeId()).toBe(textId))
    expect(view.container.querySelector('[contenteditable="true"]')).toBeTruthy()
  })

  it('opens a caret on a shape that was not selected first', async () => {
    const { view, editor } = mountBoard()
    await waitFor(() => expect(view.container.querySelectorAll('[data-canvas-shape="true"]')).toHaveLength(2))

    const bounds = editor().getShapePageBounds(geoId)!
    const point = editor().pageToViewport(bounds.center)
    const node = view.container.querySelector(`[data-shape-id="${geoId}"]`) as HTMLElement

    act(() => doubleClick(node, point.x, point.y))

    await waitFor(() => expect(editor().getEditingShapeId()).toBe(geoId))
    expect(view.container.querySelector('[contenteditable="true"]')).toBeTruthy()
  })

  it('mounts the caret inside the page layer wearing the shape page transform', async () => {
    const { view, editor } = mountBoard()
    await waitFor(() => expect(view.container.querySelectorAll('[data-canvas-shape="true"]')).toHaveLength(2))

    act(() => {
      editor().setEditingShape(textId)
    })
    await waitFor(() => expect(view.container.querySelector(`[data-canvas-text-editor="${textId}"]`)).toBeTruthy())

    const layer = view.container.querySelector(`[data-canvas-text-editor="${textId}"]`) as HTMLElement
    expect(layer.closest('[data-canvas-page-layer="true"]')).toBeTruthy()
    expect(layer.style.transform).toBe(shapeCssTransform(editor().getShapePageTransform(textId)))
  })

  it('follows the shape when it moves and when it is rotated while the caret is open', async () => {
    const { view, editor } = mountBoard()
    await waitFor(() => expect(view.container.querySelectorAll('[data-canvas-shape="true"]')).toHaveLength(2))

    act(() => {
      editor().setEditingShape(textId)
    })
    await waitFor(() => expect(view.container.querySelector(`[data-canvas-text-editor="${textId}"]`)).toBeTruthy())
    const layer = () => view.container.querySelector(`[data-canvas-text-editor="${textId}"]`) as HTMLElement
    const before = layer().style.transform

    act(() => {
      editor().updateShape({ id: textId, type: 'text', x: 300, y: 210 })
    })
    await waitFor(() => expect(layer().style.transform).not.toBe(before))
    expect(layer().style.transform).toBe(shapeCssTransform(editor().getShapePageTransform(textId)))

    act(() => {
      editor().updateShape({ id: textId, type: 'text', rotation: Math.PI / 6 })
    })
    await waitFor(() =>
      expect(layer().style.transform).toBe(shapeCssTransform(editor().getShapePageTransform(textId)))
    )
  })

  it('writes what is typed back onto the shape and leaves editing on escape', async () => {
    const { view, editor } = mountBoard()
    await waitFor(() => expect(view.container.querySelectorAll('[data-canvas-shape="true"]')).toHaveLength(2))

    const bounds = editor().getShapePageBounds(textId)!
    const point = editor().pageToViewport(bounds.center)
    const node = view.container.querySelector(`[data-shape-id="${textId}"]`) as HTMLElement
    act(() => doubleClick(node, point.x, point.y))

    await waitFor(() => expect(editor().getEditingShapeId()).toBe(textId))
    await waitFor(() => expect(editor().getRichTextEditor?.()).toBeTruthy())

    await act(async () => {
      editor().getRichTextEditor!()!.commands.focus('end')
      editor().getRichTextEditor!()!.commands.insertContent(' crew')
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    const written = editor().getShape(textId)!.props.richText as RichTextDocument
    expect(richTextToPlainText(written)).toBe('Hello crew')

    const canvas = view.container.querySelector('[data-canvas="true"]') as HTMLElement
    act(() => {
      canvas.dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    })
    await waitFor(() => expect(editor().getEditingShapeId()).toBe(null))
    expect(view.container.querySelector('[contenteditable="true"]')).toBeNull()
  })
})
