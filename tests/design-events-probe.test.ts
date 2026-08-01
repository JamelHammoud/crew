// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Editor } from '../src/renderer/src/canvas/editor'

const { CrewCanvas } = await import('../src/renderer/src/canvas/CrewCanvas')
const { createShapeId, createTLStore } = await import('../src/renderer/src/canvas/schema')
const { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } = await import('../src/renderer/src/canvas/shapes')
const { SelectTool } = await import('../src/renderer/src/canvas/tools/select')

const BOX = { left: 40, top: 24, width: 800, height: 600 }

beforeAll(() => {
  class StubResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = StubResizeObserver
  ;(HTMLCanvasElement.prototype as unknown as { getContext(): unknown }).getContext = () => null
  Element.prototype.getBoundingClientRect = function boundingRect(this: Element): DOMRect {
    const canvas = (this as HTMLElement).dataset?.canvas === 'true'
    const left = canvas ? BOX.left : 0
    const top = canvas ? BOX.top : 0
    const width = canvas ? BOX.width : 0
    const height = canvas ? BOX.height : 0
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({})
    } as DOMRect
  }
})

interface Stand {
  editor: Editor
  surface: HTMLElement
  seen: Record<string, unknown>[]
  unmount(): void
}

function stand(): Stand {
  let editor: Editor | null = null
  const view = render(
    createElement(CrewCanvas, {
      store: createTLStore({ id: 'events-probe' }),
      shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
      tools: [SelectTool],
      onMount: (made: Editor) => {
        editor = made
        return undefined
      }
    })
  )
  if (!editor) throw new Error('the canvas never mounted')
  const made = editor as Editor
  const surface = view.container.querySelector('[data-canvas="true"]') as HTMLElement
  const seen: Record<string, unknown>[] = []
  const dispatch = made.dispatch.bind(made)
  ;(made as unknown as { dispatch(info: unknown): unknown }).dispatch = (info: Record<string, unknown>) => {
    seen.push(info)
    return dispatch(info as never)
  }
  return { editor: made, surface, seen, unmount: () => view.unmount() }
}

function pointer(name: string, x: number, y: number, extra: Record<string, unknown> = {}): PointerEvent {
  const { pointerType = 'mouse', ...rest } = extra
  const event = new MouseEvent(name, {
    bubbles: true,
    cancelable: true,
    clientX: BOX.left + x,
    clientY: BOX.top + y,
    ...rest
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  Object.defineProperty(event, 'pressure', { value: 0.5 })
  return event as PointerEvent
}

function hollowGeo(editor: Editor, x: number, y: number): string {
  const id = createShapeId(`geo-${x}-${y}`)
  editor.createShape({ id, type: 'geo', x, y, props: { w: 200, h: 200, fill: 'none' } } as never)
  return id as unknown as string
}

function shapeNode(surface: HTMLElement, id: string): HTMLElement {
  const node = document.createElement('div')
  node.setAttribute('data-shape-id', id)
  node.setAttribute('data-canvas-shape', 'true')
  surface.appendChild(node)
  return node
}

describe('the canvas pointer bridge', () => {
  it('leaves which shape was hit to the state chart rather than reading it off the DOM', () => {
    const { editor, surface, seen, unmount } = stand()
    const id = hollowGeo(editor, 100, 100)
    const centre = { x: 200, y: 200 }
    const margin = editor.options.hitTestMargin / editor.getZoomLevel()

    expect(editor.getShapeAtPoint(centre, { hitInside: false, margin })).toBeFalsy()

    const node = shapeNode(surface, id)
    node.dispatchEvent(pointer('pointerdown', centre.x, centre.y))

    const down = seen.find(info => info.name === 'pointer_down')
    expect(down?.target).toBe('canvas')
    expect(editor.getSelectedShapeIds()).toEqual([])
    unmount()
  })

  it('draws a brush when a drag starts inside the hollow of an unfilled shape', () => {
    const { editor, surface, seen, unmount } = stand()
    const id = hollowGeo(editor, 100, 100)
    const node = shapeNode(surface, id)

    node.dispatchEvent(pointer('pointerdown', 200, 200))
    surface.dispatchEvent(pointer('pointermove', 240, 240))
    surface.dispatchEvent(pointer('pointermove', 280, 280))

    expect(editor.getInstanceState().brush).toBeTruthy()
    expect(editor.getShape(id as never)?.x).toBe(100)
    void seen
    unmount()
  })

  it('carries metaKey, an accel-aware ctrlKey and isPen on the dispatched event', () => {
    const { surface, seen, unmount } = stand()

    surface.dispatchEvent(pointer('pointerdown', 300, 300, { metaKey: true, pointerType: 'pen' }))

    const down = seen.find(info => info.name === 'pointer_down')
    expect(down?.metaKey).toBe(true)
    expect(down?.ctrlKey).toBe(true)
    expect(down?.isPen).toBe(true)
    unmount()
  })

  it('carries metaKey and an accel-aware ctrlKey on a key event', () => {
    const { surface, seen, unmount } = stand()

    surface.focus()
    surface.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'z', code: 'KeyZ', metaKey: true }))

    const key = seen.find(info => String(info.name).startsWith('key'))
    expect(key?.metaKey).toBe(true)
    expect(key?.ctrlKey).toBe(true)
    unmount()
  })
})

describe('where the canvas listens', () => {
  it('keeps following the pointer once it has left the canvas element', () => {
    const { editor, surface, seen, unmount } = stand()

    surface.dispatchEvent(pointer('pointerdown', 300, 300))
    seen.length = 0
    document.body.dispatchEvent(pointer('pointermove', 500, 420))

    expect(seen.some(info => info.name === 'pointer_move')).toBe(true)
    expect(editor.inputs.getCurrentScreenPoint().x).toBe(500)
    expect(editor.inputs.getCurrentScreenPoint().y).toBe(420)
    unmount()
  })

  it('hears the keyboard when the canvas element does not hold focus', () => {
    const { surface, seen, unmount } = stand()
    const elsewhere = document.createElement('div')
    elsewhere.tabIndex = 0
    document.body.appendChild(elsewhere)
    elsewhere.focus()
    expect(document.activeElement).not.toBe(surface)

    seen.length = 0
    elsewhere.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Delete', code: 'Delete' }))

    expect(seen.some(info => info.name === 'key_down')).toBe(true)
    elsewhere.remove()
    unmount()
  })

  it('leaves the keyboard alone while somebody is typing', () => {
    const { seen, unmount } = stand()
    const field = document.createElement('input')
    document.body.appendChild(field)
    field.focus()

    seen.length = 0
    field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'r', code: 'KeyR' }))

    expect(seen.some(info => String(info.name).startsWith('key'))).toBe(false)
    field.remove()
    unmount()
  })

  it('dispatches a pointer move once when two canvases are mounted', () => {
    const first = stand()
    const second = stand()

    first.seen.length = 0
    second.seen.length = 0
    document.body.dispatchEvent(pointer('pointermove', 320, 300))

    const moves = [...first.seen, ...second.seen].filter(info => info.name === 'pointer_move')
    expect(moves).toHaveLength(1)
    first.unmount()
    second.unmount()
  })
})
