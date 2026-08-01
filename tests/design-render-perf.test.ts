import { act, cleanup, render } from '@testing-library/react'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Mat } from '../src/renderer/src/canvas/math'
import { atom } from '../src/renderer/src/canvas/signals'
import {
  Canvas,
  RenderingShapeOrder,
  sameRenderingShapes,
  shapeStyle,
  sortRenderingShapes,
  type CanvasOverlayEntry,
  type CanvasRenderHost,
  type CanvasRenderingShape,
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

const COUNT = 200

function board(count = COUNT) {
  const shapes = atom<Shape[]>(
    'perf shapes',
    Array.from({ length: count }, (_unused, at) => ({
      id: `shape:${String(at).padStart(4, '0')}`,
      type: 'card' as const,
      x: at * 3,
      y: at * 2,
      props: { w: 40, h: 30, label: `Card ${at}` },
      meta: {}
    }))
  )
  const byId = () => new Map(shapes.get().map(shape => [shape.id, shape] as const))
  const camera = atom('perf camera', { x: 0, y: 0, z: 1 })
  const culled = atom<ReadonlySet<string>>('perf culled', new Set())
  const cameraState = atom<'idle' | 'moving'>('perf camera state', 'idle')
  const instance = atom('perf instance', { devicePixelRatio: 1, screenBounds: { x: 0, y: 0, w: 800, h: 600 } })
  const entries = atom<CanvasOverlayEntry[]>('perf overlays', [])
  const overlays = {
    getActiveOverlayEntries: () => entries.get(),
    getOverlayUtil: () => ({ isActive: () => false, render: () => undefined })
  }
  const host: CanvasRenderHost<Shape> = {
    overlays,
    getCamera: () => camera.get(),
    getCameraState: () => cameraState.get(),
    getInstanceState: () => instance.get(),
    getRenderingShapes: () =>
      shapes.get().map((shape, index) => ({
        id: shape.id,
        shape,
        index,
        backgroundIndex: index,
        opacity: 1
      })),
    getCulledShapes: () => culled.get(),
    getShape: id => byId().get(id),
    getShapePageTransform: id => {
      const shape = byId().get(id)
      return shape ? Mat.Translate(shape.x, shape.y) : undefined
    },
    getShapeGeometry: shape => ({ bounds: { x: 0, y: 0, w: shape.props.w, h: shape.props.h } }),
    getShapeClipPath: () => undefined,
    getSelectedShapeIds: () => [],
    getEditingShapeId: () => null
  }
  const move = (id: string, x: number, y: number) =>
    shapes.set(shapes.get().map(shape => (shape.id === id ? { ...shape, x, y } : shape)))
  const relabel = (id: string, label: string) =>
    shapes.set(
      shapes.get().map(shape => (shape.id === id ? { ...shape, props: { ...shape.props, label } } : shape))
    )
  return { shapes, camera, culled, cameraState, instance, entries, host, move, relabel }
}

function counted() {
  const renders = new Map<string, number>()
  const renderer: CanvasShapeRenderer<Shape> = {
    render: shape => {
      renders.set(shape.id, (renders.get(shape.id) ?? 0) + 1)
      return createElement('span', null, shape.props.label)
    }
  }
  const total = () => [...renders.values()].reduce((sum, value) => sum + value, 0)
  return { renders, renderer, total }
}

function canvasContext() {
  return { setTransform: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn() }
}

function stubCanvas() {
  const context = canvasContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  return context
}

const entry = (id: string, index: number): CanvasRenderingShape<Shape> => ({
  id,
  shape: { id, type: 'card', x: 0, y: 0, props: { w: 1, h: 1, label: id }, meta: {} },
  index,
  backgroundIndex: index,
  opacity: 1
})

describe('design board render work', () => {
  it('moves a shape without rendering a single React component', () => {
    stubCanvas()
    const state = board()
    const { renderer, total } = counted()
    const view = render(createElement(Canvas<Shape>, { host: state.host, shapeRenderer: renderer }))
    const node = view.container.querySelector('[data-shape-id="shape:0007"]') as HTMLElement
    const mountRenders = total()
    expect(mountRenders).toBe(COUNT)

    for (let at = 1; at <= 20; at++) act(() => state.move('shape:0007', 100 + at, 200 + at))

    expect(total()).toBe(mountRenders)
    expect(view.container.querySelector('[data-shape-id="shape:0007"]')).toBe(node)
    expect(node.style.transform).toBe('matrix(1, 0, 0, 1, 120, 220)')
  })

  it('renders only the shape whose own content changed', () => {
    stubCanvas()
    const state = board()
    const { renders, renderer, total } = counted()
    render(createElement(Canvas<Shape>, { host: state.host, shapeRenderer: renderer }))
    const mountRenders = total()

    act(() => state.relabel('shape:0011', 'Away'))

    expect(total()).toBe(mountRenders + 1)
    expect(renders.get('shape:0011')).toBe(2)
    expect(renders.get('shape:0012')).toBe(1)
  })

  it('leaves every shape alone when the camera moves', () => {
    stubCanvas()
    const state = board()
    const { renderer, total } = counted()
    const view = render(createElement(Canvas<Shape>, { host: state.host, shapeRenderer: renderer }))
    const pageLayer = view.container.querySelector('[data-canvas-page-layer="true"]') as HTMLElement
    const mountRenders = total()

    for (let at = 1; at <= 20; at++) act(() => state.camera.set({ x: at * 4, y: at * 3, z: 1 }))

    expect(total()).toBe(mountRenders)
    expect(pageLayer.style.transform).toContain('scale(1)')
  })

  it('hides a shape that was already outside the viewport when it mounted', () => {
    stubCanvas()
    const state = board()
    state.culled.set(new Set(['shape:0003']))
    const { renderer } = counted()
    const view = render(createElement(Canvas<Shape>, { host: state.host, shapeRenderer: renderer }))

    expect((view.container.querySelector('[data-shape-id="shape:0003"]') as HTMLElement).style.display).toBe('none')
    expect((view.container.querySelector('[data-shape-id="shape:0004"]') as HTMLElement).style.display).toBe('block')

    act(() => state.culled.set(new Set(['shape:0004'])))
    expect((view.container.querySelector('[data-shape-id="shape:0003"]') as HTMLElement).style.display).toBe('block')
    expect((view.container.querySelector('[data-shape-id="shape:0004"]') as HTMLElement).style.display).toBe('none')
  })

  it('paints the overlays once a frame however often the camera changes', async () => {
    const context = stubCanvas()
    const state = board()
    const { renderer } = counted()
    render(createElement(Canvas<Shape>, { host: state.host, shapeRenderer: renderer }))
    const painted = context.clearRect.mock.calls.length

    act(() => {
      for (let at = 1; at <= 20; at++) state.camera.set({ x: at, y: at, z: 1 })
    })
    expect(context.clearRect.mock.calls.length).toBe(painted)

    await act(async () => {
      await new Promise<void>(done => dom.window.requestAnimationFrame(() => done()))
    })
    expect(context.clearRect.mock.calls.length).toBe(painted + 1)
  })

  it('keeps DOM order by id so a z-order change never remounts a node', () => {
    const shapes = [entry('shape:z', 0), entry('shape:a', 1), entry('shape:m', 2)]
    expect(sortRenderingShapes(shapes).map(one => one.id)).toEqual(['shape:a', 'shape:m', 'shape:z'])
    expect(shapes.map(one => one.id)).toEqual(['shape:z', 'shape:a', 'shape:m'])
  })

  it('reuses the sort order while the same shapes are on the page', () => {
    const order = new RenderingShapeOrder()
    const make = () => Array.from({ length: 64 }, (_unused, at) => entry(`shape:${String(63 - at).padStart(2, '0')}`, at))
    const first = order.sort(make()).map(one => one.id)
    const sort = vi.spyOn(Array.prototype, 'sort')
    const second = order.sort(make()).map(one => one.id)
    expect(sort).not.toHaveBeenCalled()
    sort.mockRestore()
    expect(second).toEqual(first)
    expect(second).toEqual([...first].sort())
  })

  it('sorts again when the shapes on the page change', () => {
    const order = new RenderingShapeOrder()
    const many = Array.from({ length: 64 }, (_unused, at) => entry(`shape:${String(at).padStart(2, '0')}`, at))
    order.sort(many.slice())
    const next = order.sort([...many.slice(1), entry('shape:aa', 64)])
    expect(next.map(one => one.id)).toEqual([...next.map(one => one.id)].sort())
    expect(next).toHaveLength(64)
  })

  it('reads a list as unchanged when only position moved and as changed when content did', () => {
    const first = [entry('shape:a', 0), entry('shape:b', 1)]
    const moved = first.map(one => ({ ...one, shape: { ...one.shape, x: one.shape.x + 10 } }))
    expect(sameRenderingShapes(first, moved)).toBe(true)

    const edited = first.map((one, at) =>
      at === 0 ? { ...one, shape: { ...one.shape, props: { ...one.shape.props, label: 'Away' } } } : one
    )
    expect(sameRenderingShapes(first, edited)).toBe(false)
    expect(sameRenderingShapes(first, [{ ...first[0], index: 9 }, first[1]])).toBe(false)
    expect(sameRenderingShapes(first, [first[0]])).toBe(false)
  })

  it('holds every shape in its own layout and size box', () => {
    expect(shapeStyle.contain).toBe('size layout')
    expect(shapeStyle.transformOrigin).toBe('top left')
    expect(shapeStyle.position).toBe('absolute')
    expect(pageLayerStyle.contain).toBe('layout style size')
    expect(canvasStyle.contain).toBe('strict')
    expect(shapeStyle.willChange).toBeUndefined()
  })
})
