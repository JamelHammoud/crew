import { act, cleanup, render, } from '@testing-library/react'
import { createRequire } from 'node:module'
import { StrictMode, createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CrewCanvas } from '../src/renderer/src/canvas/CrewCanvas'
import type { Editor } from '../src/renderer/src/canvas/editor'
import { createTLStore } from '../src/renderer/src/canvas/schema'
import { TextShapeUtil } from '../src/renderer/src/canvas/shapes'

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
  'getComputedStyle',
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
  setGlobal('getComputedStyle', view.getComputedStyle.bind(view))
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

function mountBoard(): { view: ReturnType<typeof render>; editor: () => Editor } {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawingContext())
  const store = createTLStore({ id: 'canvas-text-caret-probe' })
  let made: Editor | undefined
  const onMount = (subject: Editor) => {
    made = subject
    return undefined
  }
  const view = render(
    createElement(StrictMode, null, createElement(CrewCanvas, { store, shapeUtils: [TextShapeUtil], onMount }))
  )
  return { view, editor: () => made! }
}

function pointer(type: string, x: number, y: number, buttons: number): MouseEvent {
  const event = new dom.window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, buttons })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'mouse' },
    pressure: { value: buttons ? 0.5 : 0 },
    isPrimary: { value: true }
  })
  return event
}

function click(node: HTMLElement, x: number, y: number): void {
  node.dispatchEvent(pointer('pointerdown', x, y, 1))
  node.dispatchEvent(pointer('pointermove', x, y, 1))
  node.dispatchEvent(pointer('pointerup', x, y, 0))
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 30))
  })
}

describe('placing a text shape with the text tool', () => {
  it('creates the shape and opens a caret in it', async () => {
    const { view, editor } = mountBoard()
    const surface = view.container.querySelector('[data-canvas="true"]') as HTMLElement

    act(() => {
      editor().setCurrentTool('text')
    })
    act(() => click(surface, 200, 150))
    await settle()

    const shapes = editor().getCurrentPageShapes()
    expect(shapes).toHaveLength(1)
    expect(shapes[0].type).toBe('text')
    expect(editor().getEditingShapeId()).toBe(shapes[0].id)
  })

  it('leaves the caret in the live text editor rather than a destroyed one', async () => {
    const { view, editor } = mountBoard()
    const surface = view.container.querySelector('[data-canvas="true"]') as HTMLElement

    act(() => {
      editor().setCurrentTool('text')
    })
    act(() => click(surface, 200, 150))
    await settle()

    const writing = view.container.querySelector('[contenteditable="true"]') as HTMLElement
    expect(writing).toBeTruthy()
    const live = editor().getRichTextEditor() as unknown as { isDestroyed: boolean; isFocused: boolean }
    expect(live).toBeTruthy()
    expect(live.isDestroyed).toBe(false)
    expect(live.isFocused).toBe(true)
    expect(writing.contains(dom.window.document.activeElement)).toBe(true)
  })

  it('writes what is typed straight into the new shape', async () => {
    const { view, editor } = mountBoard()
    const surface = view.container.querySelector('[data-canvas="true"]') as HTMLElement

    act(() => {
      editor().setCurrentTool('text')
    })
    act(() => click(surface, 200, 150))
    await settle()

    const id = editor().getCurrentPageShapes()[0].id
    await act(async () => {
      const commands = (editor().getRichTextEditor() as unknown as {
        commands: Record<string, (value?: unknown) => unknown>
      }).commands
      commands.insertContent('typed')
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    expect(editor().getShapeUtil(editor().getShape(id)!).getText?.(editor().getShape(id)!)).toBe('typed')
  })

  it('focuses a fixed-width text immediately after dragging it out', async () => {
    const { view, editor } = mountBoard()
    const surface = view.container.querySelector('[data-canvas="true"]') as HTMLElement

    act(() => {
      editor().setCurrentTool('text')
      surface.dispatchEvent(pointer('pointerdown', 120, 120, 1))
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 170))
      surface.dispatchEvent(pointer('pointermove', 320, 120, 1))
      surface.dispatchEvent(pointer('pointerup', 320, 120, 0))
    })
    await settle()

    const shape = editor().getCurrentPageShapes()[0]
    expect(shape).toMatchObject({ type: 'text', props: expect.objectContaining({ autoSize: false }) })
    expect(editor().getEditingShapeId()).toBe(shape.id)
    const live = editor().getRichTextEditor() as unknown as { isDestroyed: boolean; isFocused: boolean }
    expect(live.isDestroyed).toBe(false)
    expect(live.isFocused).toBe(true)
    const writing = view.container.querySelector('[contenteditable="true"]') as HTMLElement
    expect(writing.contains(dom.window.document.activeElement)).toBe(true)
  })
})
