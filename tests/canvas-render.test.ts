import { act, cleanup, render } from '@testing-library/react'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Mat } from '../src/renderer/src/canvas/math'
import { atom } from '../src/renderer/src/canvas/signals'
import {
  Canvas,
  CANVAS_SCALE_VARIABLE,
  CANVAS_ZOOM_VARIABLE,
  cameraCssTransform,
  cameraZoomVariables,
  cameraOffset,
  sortRenderingShapes,
  type CanvasOverlayEntry,
  type CanvasRenderHost,
  type CanvasShapeRecord,
  type CanvasShapeRenderer
} from '../src/renderer/src/canvas/render'

interface Shape extends CanvasShapeRecord {
  id: string
  type: 'card'
  x: number
  y: number
  props: { w: number; h: number; label: string }
  meta: Record<string, unknown>
}

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
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT'
] as const

const originalGlobals = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const))

const setGlobal = (key: (typeof globalKeys)[number], value: unknown) =>
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })

const JSDOM = createRequire(import.meta.url)('jsdom').JSDOM as new (
  html: string,
  options: { pretendToBeVisual: boolean }
) => { window: Window & typeof globalThis }

let dom: { window: Window & typeof globalThis }

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
  setGlobal('requestAnimationFrame', view.requestAnimationFrame.bind(view))
  setGlobal('cancelAnimationFrame', view.cancelAnimationFrame.bind(view))
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true)
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

function setup() {
  const shape = atom<Shape>('render shape', {
    id: 'shape:b',
    type: 'card',
    x: 10,
    y: 20,
    props: { w: 80, h: 50, label: 'Home' },
    meta: {}
  })
  const camera = atom('render camera', { x: 0, y: 0, z: 1 })
  const culled = atom<ReadonlySet<string>>('render culled', new Set())
  const cameraState = atom<'idle' | 'moving'>('render camera state', 'idle')
  const instance = atom('render instance', {
    devicePixelRatio: 1,
    screenBounds: { x: 0, y: 0, w: 300, h: 200 }
  })
  const entries = atom<CanvasOverlayEntry[]>('render overlays', [])
  const overlays = {
    getActiveOverlayEntries: () => entries.get(),
    getOverlayUtil: () => ({ isActive: () => false, render: () => undefined })
  }
  const host: CanvasRenderHost<Shape> = {
    overlays,
    getCamera: () => camera.get(),
    getCameraState: () => cameraState.get(),
    getInstanceState: () => instance.get(),
    getRenderingShapes: () => [{ id: shape.get().id, shape: shape.get(), index: 7, backgroundIndex: 6, opacity: 0.8 }],
    getCulledShapes: () => culled.get(),
    getShape: id => (id === shape.get().id ? shape.get() : undefined),
    getShapePageTransform: id => {
      const current = shape.get()
      return id === current.id ? Mat.Translate(current.x, current.y) : undefined
    },
    getShapeGeometry: current => ({
      bounds: { x: 0, y: 0, w: current.props.w, h: current.props.h }
    }),
    getShapeClipPath: () => undefined,
    getSelectedShapeIds: () => [],
    getEditingShapeId: () => null
  }
  return { shape, camera, culled, cameraState, instance, entries, host }
}

function canvasContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn()
  }
}

describe('canvas rendering', () => {
  it('uses the same camera alignment curve as the installed renderer', () => {
    expect(cameraOffset(0.1)).toBe(-2)
    expect(cameraOffset(1)).toBe(0.125)
    expect(cameraOffset(8)).toBe(0.5)
    expect(cameraCssTransform({ x: 10, y: -4, z: 2 })).toBe('scale(2) translate(10.1786px,-3.8214px)')
  })

  it('keeps shape DOM order stable by id', () => {
    const result = sortRenderingShapes([
      { id: 'shape:z', shape: {} as Shape, index: 1, backgroundIndex: 0, opacity: 1 },
      { id: 'shape:a', shape: {} as Shape, index: 2, backgroundIndex: 1, opacity: 1 }
    ])
    expect(result.map(item => item.id)).toEqual(['shape:a', 'shape:z'])
  })

  it('writes motion and culling straight to a mounted shape without rebuilding its content', () => {
    const context = canvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    const state = setup()
    let shapeRenders = 0
    const renderer: CanvasShapeRenderer<Shape> = {
      render: current => {
        shapeRenders++
        return createElement('span', null, current.props.label)
      }
    }
    const view = render(createElement(Canvas<Shape>, { host: state.host, shapeRenderer: renderer }))
    const node = view.container.querySelector('[data-canvas-shape="true"]') as HTMLElement
    const pageLayer = view.container.querySelector('[data-canvas-page-layer="true"]') as HTMLElement

    expect(node.style.transform).toBe('matrix(1, 0, 0, 1, 10, 20)')
    expect(node.style.width).toBe('80px')
    expect(node.style.height).toBe('50px')
    expect(node.style.opacity).toBe('0.8')
    expect(node.style.zIndex).toBe('7')
    expect(shapeRenders).toBe(1)

    act(() => state.shape.set({ ...state.shape.get(), x: 45, y: 60 }))
    expect(view.container.querySelector('[data-canvas-shape="true"]')).toBe(node)
    expect(node.style.transform).toBe('matrix(1, 0, 0, 1, 45, 60)')
    expect(shapeRenders).toBe(1)

    act(() => state.culled.set(new Set(['shape:b'])))
    expect(node.style.display).toBe('none')
    act(() => state.culled.set(new Set()))
    expect(node.style.display).toBe('block')

    act(() => state.camera.set({ x: 12, y: 5, z: 2 }))
    expect(pageLayer.style.transform).toBe(cameraCssTransform({ x: 12, y: 5, z: 2 }))
    expect(shapeRenders).toBe(1)

    act(() => {
      const current = state.shape.get()
      state.shape.set({ ...current, props: { ...current.props, label: 'Away' } })
    })
    expect(shapeRenders).toBe(2)
    expect(node.textContent).toBe('Away')
  })

  it('publishes the zoom and its reciprocal so chrome can hold its size on screen', () => {
    const context = canvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    const state = setup()
    let shapeRenders = 0
    const renderer: CanvasShapeRenderer<Shape> = {
      render: () => {
        shapeRenders++
        return null
      }
    }
    const view = render(createElement(Canvas<Shape>, { host: state.host, shapeRenderer: renderer }))
    const root = view.container.querySelector('[data-canvas="true"]') as HTMLElement

    expect(root.style.getPropertyValue(CANVAS_ZOOM_VARIABLE)).toBe('1')
    expect(root.style.getPropertyValue(CANVAS_SCALE_VARIABLE)).toBe('1')

    act(() => state.camera.set({ x: 0, y: 0, z: 4 }))
    expect(root.style.getPropertyValue(CANVAS_ZOOM_VARIABLE)).toBe('4')
    expect(root.style.getPropertyValue(CANVAS_SCALE_VARIABLE)).toBe('0.25')

    act(() => state.camera.set({ x: 0, y: 0, z: 0.14 }))
    expect(root.style.getPropertyValue(CANVAS_ZOOM_VARIABLE)).toBe('0.14')
    expect(root.style.getPropertyValue(CANVAS_SCALE_VARIABLE)).toBe(String(cameraZoomVariables(0.14).scale))
    expect(Number(root.style.getPropertyValue(CANVAS_SCALE_VARIABLE))).toBeCloseTo(1 / 0.14, 3)

    expect(shapeRenders).toBe(1)
  })

  it('sizes its bitmap and hands overlay renderers page-space coordinates', () => {
    const context = canvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    const state = setup()
    const paint = vi.fn()
    state.entries.set([{ util: { isActive: () => true, render: paint }, overlays: [] }])
    state.instance.set({
      devicePixelRatio: 2,
      screenBounds: { x: 0, y: 0, w: 200, h: 100 }
    })
    state.camera.set({ x: 5, y: -3, z: 2 })
    const renderer: CanvasShapeRenderer<Shape> = { render: () => null }
    const view = render(createElement(Canvas<Shape>, { host: state.host, shapeRenderer: renderer }))
    const canvas = view.container.querySelector('canvas') as HTMLCanvasElement

    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(200)
    expect(context.setTransform).toHaveBeenCalledWith(4, 0, 0, 4, 20, -12)
    expect(paint).toHaveBeenCalledWith(context, [])
    expect(context.save).toHaveBeenCalledTimes(1)
    expect(context.restore).toHaveBeenCalledTimes(1)
  })

  it('coalesces overlay changes into one paint with the latest state', () => {
    let queued: FrameRequestCallback | null = null
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
      queued = callback
      return 1
    })
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const context = canvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    const state = setup()
    const paint = vi.fn()
    const renderer: CanvasShapeRenderer<Shape> = { render: () => null }
    render(createElement(Canvas<Shape>, { host: state.host, shapeRenderer: renderer }))
    context.clearRect.mockClear()

    act(() => {
      state.entries.set([{ util: { isActive: () => true, render: paint }, overlays: [{ id: 'one' }] }])
      state.entries.set([{ util: { isActive: () => true, render: paint }, overlays: [{ id: 'two' }] }])
      state.entries.set([{ util: { isActive: () => true, render: paint }, overlays: [{ id: 'latest' }] }])
    })

    expect(context.clearRect).not.toHaveBeenCalled()
    expect(queued).not.toBeNull()
    act(() => {
      const callback = queued as FrameRequestCallback | null
      queued = null
      callback?.(16)
    })
    expect(context.clearRect).toHaveBeenCalledTimes(1)
    expect(paint).toHaveBeenCalledTimes(1)
    expect(paint.mock.calls[0][1]).toEqual([{ id: 'latest' }])
  })
})
