import { act, cleanup, render } from '@testing-library/react'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Mat } from '../src/renderer/src/canvas/math'
import { atom } from '../src/renderer/src/canvas/signals'
import {
  Canvas,
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
  const shape = atom<Shape>('camera probe shape', {
    id: 'shape:b',
    type: 'card',
    x: 10,
    y: 20,
    props: { w: 80, h: 50, label: 'Home' },
    meta: {}
  })
  const camera = atom('camera probe camera', { x: 0, y: 0, z: 1 })
  const culled = atom<ReadonlySet<string>>('camera probe culled', new Set())
  const cameraState = atom<'idle' | 'moving'>('camera probe camera state', 'idle')
  const instance = atom('camera probe instance', {
    devicePixelRatio: 1,
    screenBounds: { x: 0, y: 0, w: 300, h: 200 }
  })
  const entries = atom<CanvasOverlayEntry[]>('camera probe overlays', [])
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

const canvasContext = () => ({
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn()
})

describe('what a moving camera costs the shape layer', () => {
  it('keeps the camera state out of the canvas, so a pan never rebuilds the shapes', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      canvasContext() as unknown as CanvasRenderingContext2D
    )
    const state = setup()
    const renderer: CanvasShapeRenderer<Shape> = { render: () => null }
    const roots: Array<HTMLElement | null> = []

    const view = render(
      createElement(Canvas<Shape>, {
        host: state.host,
        shapeRenderer: renderer,
        canvasRef: element => roots.push(element)
      })
    )
    const shapeNode = view.container.querySelector('[data-canvas-shape="true"]')
    const settled = roots.length

    act(() => state.cameraState.set('moving'))
    act(() => state.cameraState.set('idle'))
    act(() => state.cameraState.set('moving'))

    expect(roots.length).toBe(settled)
    expect(view.container.querySelector('[data-canvas-shape="true"]')).toBe(shapeNode)
  })

  it('still stands the blocker over everything while the camera is moving', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      canvasContext() as unknown as CanvasRenderingContext2D
    )
    const state = setup()
    const renderer: CanvasShapeRenderer<Shape> = { render: () => null }
    const view = render(createElement(Canvas<Shape>, { host: state.host, shapeRenderer: renderer }))
    const blocker = () => view.container.querySelector('[data-canvas-hit-test-blocker="true"]')

    expect(blocker()).toBeNull()
    act(() => state.cameraState.set('moving'))
    expect(blocker()?.className).toBe('crew-hit-test-blocker')
    act(() => state.cameraState.set('idle'))
    expect(blocker()).toBeNull()
  })
})

describe('what a culled shape keeps', () => {
  it('leaves a culled shape mounted and only takes it out of the painting', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      canvasContext() as unknown as CanvasRenderingContext2D
    )
    const state = setup()
    let renders = 0
    const renderer: CanvasShapeRenderer<Shape> = {
      render: current => {
        renders++
        return createElement('span', null, current.props.label)
      }
    }
    const view = render(createElement(Canvas<Shape>, { host: state.host, shapeRenderer: renderer }))
    const node = view.container.querySelector('[data-canvas-shape="true"]') as HTMLElement
    expect(renders).toBe(1)

    act(() => state.culled.set(new Set(['shape:b'])))
    expect(view.container.querySelector('[data-canvas-shape="true"]')).toBe(node)
    expect(node.style.display).toBe('none')
    expect(node.textContent).toBe('Home')
    expect(renders).toBe(1)

    act(() => state.culled.set(new Set()))
    expect(node.style.display).toBe('block')
    expect(renders).toBe(1)
  })
})
