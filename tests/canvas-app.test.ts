import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CrewCanvas } from '../src/renderer/src/canvas/CrewCanvas'
import type { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, LineShapeUtil, TextShapeUtil } from '../src/renderer/src/canvas/shapes'

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
  const rect = {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 400,
    bottom: 300,
    width: 400,
    height: 300,
    toJSON: () => ({})
  }
  Object.defineProperty(view.HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect
  })
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

function context(): CanvasRenderingContext2D {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    setLineDash: vi.fn()
  } as unknown as CanvasRenderingContext2D
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

describe('the mounted Crew canvas', () => {
  it('paints, selects, drags and opens rich text editing through native events', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context())
    const store = createTLStore({ id: 'canvas-app-test' })
    const frameId = createShapeId('frame')
    const textId = createShapeId('text')
    let editor: Editor | undefined
    const mounted = (subject: Editor) => {
      editor = subject
      subject.createShapes([
        { id: frameId, type: 'frame', x: 10, y: 10, props: { w: 100, h: 60, name: 'Frame', color: 'black' } },
        {
          id: textId,
          type: 'text',
          x: 20,
          y: 100,
          props: {
            color: 'black',
            size: 'm',
            w: 80,
            font: 'draw',
            textAlign: 'start',
            autoSize: true,
            scale: 1,
            richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }
          }
        }
      ])
      return undefined
    }
    const view = render(
      createElement(CrewCanvas, {
        store,
        shapeUtils: [FrameShapeUtil, TextShapeUtil, LineShapeUtil],
        onMount: mounted
      })
    )

    await waitFor(() => expect(view.container.querySelectorAll('[data-canvas-shape="true"]')).toHaveLength(2))
    const frame = view.container.querySelector(`[data-shape-id="${frameId}"]`) as HTMLElement
    act(() => frame.dispatchEvent(pointer('pointerdown', 20, 20, 1)))
    expect(editor?.getSelectedShapeIds()).toEqual([frameId])
    act(() => frame.dispatchEvent(pointer('pointermove', 40, 20, 1)))
    act(() => frame.dispatchEvent(pointer('pointerup', 40, 20, 0)))
    expect(editor?.getShape(frameId)?.x).toBe(30)

    const canvas = view.container.querySelector('[data-canvas="true"]') as HTMLElement
    const beforeResize = editor!.getShapePageBounds(frameId)!
    act(() => canvas.dispatchEvent(pointer('pointerdown', beforeResize.maxX, beforeResize.maxY, 1)))
    expect((editor!.root.getCurrent() as { getPath(): string }).getPath()).toBe('select.pointing_resize_handle')
    act(() => canvas.dispatchEvent(pointer('pointermove', beforeResize.maxX + 30, beforeResize.maxY + 20, 1)))
    expect((editor!.root.getCurrent() as { getPath(): string }).getPath()).toBe('select.resizing')
    act(() => canvas.dispatchEvent(pointer('pointerup', beforeResize.maxX + 30, beforeResize.maxY + 20, 0)))
    const afterResize = editor!.getShapePageBounds(frameId)!
    expect(afterResize.w).toBeGreaterThan(beforeResize.w)
    expect(afterResize.h).toBeGreaterThan(beforeResize.h)

    act(() => editor!.setCurrentTool('line'))
    act(() => canvas.dispatchEvent(pointer('pointerdown', 200, 200, 1)))
    act(() => canvas.dispatchEvent(pointer('pointermove', 260, 240, 1)))
    act(() => canvas.dispatchEvent(pointer('pointerup', 260, 240, 0)))
    const line = editor!.getCurrentPageShapes().find(shape => shape.type === 'line')
    expect(line?.type).toBe('line')
    expect(line?.props.points).toEqual(
      expect.objectContaining({ a2: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }) })
    )
    if (line?.type === 'line') {
      expect(line.props.points.a2.x).toBeGreaterThan(40)
      expect(line.props.points.a2.y).toBeGreaterThan(20)
    }
    act(() => editor!.setCurrentTool('select'))

    const text = view.container.querySelector(`[data-shape-id="${textId}"]`) as HTMLElement
    act(() => text.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true, clientX: 25, clientY: 105 })))
    await waitFor(() => expect(view.getByTestId('canvas-rich-text-editor')).toBeTruthy())
    expect(editor?.getEditingShapeId()).toBe(textId)
    expect(text.firstElementChild?.getAttribute('style')).toContain('visibility: hidden')
    expect(view.container.querySelector('[data-iseditinganything="true"]')).toBeTruthy()
  })
})
