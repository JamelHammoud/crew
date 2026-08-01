// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { act, createElement } from 'react'
import { describe, expect, it } from 'vitest'

const { CrewCanvas } = await import('../src/renderer/src/canvas/CrewCanvas')
const { createShapeId, createTLStore } = await import('../src/renderer/src/canvas/schema')
const { GeoShapeUtil, FrameShapeUtil, GroupShapeUtil } = await import('../src/renderer/src/canvas/shapes')
const { SelectTool } = await import('../src/renderer/src/canvas/tools/select')
import type { Editor } from '../src/renderer/src/canvas/editor'

const BOX = { left: 40, top: 24, width: 800, height: 600 }

class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = StubResizeObserver
;(HTMLCanvasElement.prototype as unknown as { getContext(): unknown }).getContext = () => null
Element.prototype.getBoundingClientRect = function boundingRect(this: Element): DOMRect {
  if ((this as HTMLElement).dataset?.canvas === 'true') {
    return {
      left: BOX.left,
      top: BOX.top,
      width: BOX.width,
      height: BOX.height,
      right: BOX.left + BOX.width,
      bottom: BOX.top + BOX.height,
      x: BOX.left,
      y: BOX.top,
      toJSON: () => ({})
    } as DOMRect
  }
  return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
}

function stand(): { editor: Editor; surface: HTMLElement; unmount(): void } {
  let editor: Editor | null = null
  const store = createTLStore({ id: 'events-probe' })
  const view = render(
    createElement(CrewCanvas, {
      store,
      shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
      tools: [SelectTool],
      onMount: (made: Editor) => {
        editor = made
        return undefined
      }
    })
  )
  const surface = view.container.querySelector('[data-canvas="true"]') as HTMLElement
  if (!editor) throw new Error('the canvas never mounted')
  return { editor: editor as Editor, surface, unmount: () => view.unmount() }
}

function pointerEvent(name: string, x: number, y: number, extra: Record<string, unknown> = {}): PointerEvent {
  const event = new MouseEvent(name, { bubbles: true, cancelable: true, clientX: x, clientY: y, ...extra })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  Object.defineProperty(event, 'pressure', { value: 0.5 })
  return event as PointerEvent
}

describe('design canvas event pipeline', () => {
  it('reports what the pipeline does today', () => {
    const { editor, surface, unmount } = stand()
    const seen: Record<string, unknown>[] = []
    const original = editor.dispatch.bind(editor)
    ;(editor as unknown as { dispatch(info: unknown): unknown }).dispatch = (info: Record<string, unknown>) => {
      seen.push(info)
      return original(info as never)
    }

    const id = createShapeId('probe-geo')
    editor.createShape({ id, type: 'geo', x: 100, y: 100, props: { w: 100, h: 100 } } as never)

    surface.dispatchEvent(pointerEvent('pointerdown', 40 + 300, 24 + 300, { metaKey: true, ctrlKey: false }))
    const down = seen.find(info => info.name === 'pointer_down')
    console.log('POINTER DOWN INFO', JSON.stringify({ ...down, originalEvent: undefined }, null, 1))
    console.log('SCREEN BOUNDS', JSON.stringify(editor.getViewportScreenBounds().toJson()))
    console.log('ORIGIN SCREEN', JSON.stringify(editor.inputs.getOriginScreenPoint()))
    console.log('ORIGIN PAGE', JSON.stringify(editor.inputs.getOriginPagePoint()))

    seen.length = 0
    document.body.dispatchEvent(pointerEvent('pointermove', 40 + 360, 24 + 360))
    console.log('MOVE ON DOCUMENT REACHED BRIDGE:', seen.some(info => info.name === 'pointer_move'))

    seen.length = 0
    surface.dispatchEvent(pointerEvent('pointermove', 40 + 360, 24 + 360))
    console.log('MOVE ON SURFACE REACHED BRIDGE:', seen.some(info => info.name === 'pointer_move'))

    console.log('TABINDEX', surface.getAttribute('tabindex'))
    console.log('ACTIVE IS SURFACE', document.activeElement === surface)

    seen.length = 0
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a', code: 'KeyA' }))
    console.log('KEY ON DOCUMENT REACHED BRIDGE:', seen.some(info => String(info.name).startsWith('key')))

    const outside = document.createElement('input')
    document.body.appendChild(outside)
    outside.focus()
    seen.length = 0
    outside.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape', code: 'Escape' }))
    console.log('KEY WHILE FOCUS ELSEWHERE REACHED BRIDGE:', seen.some(info => String(info.name).startsWith('key')))
    surface.focus()

    unmount()
    expect(true).toBe(true)
  })

  it('reports what a brush drag and a shape drag do today', () => {
    const { editor, surface, unmount } = stand()
    const id = createShapeId('drag-geo')
    editor.createShape({ id, type: 'geo', x: 100, y: 100, props: { w: 100, h: 100 } } as never)
    const node = () => surface.querySelector(`[data-shape-id="${id}"]`) as HTMLElement | null
    console.log('SHAPE NODE IN DOM:', Boolean(node()))

    surface.dispatchEvent(pointerEvent('pointerdown', 40 + 400, 24 + 400))
    surface.dispatchEvent(pointerEvent('pointermove', 40 + 420, 24 + 420))
    surface.dispatchEvent(pointerEvent('pointermove', 40 + 450, 24 + 450))
    console.log('AFTER BRUSH MOVES, PATH:', editor.getPath?.() ?? 'no getPath')
    console.log('IS DRAGGING:', editor.inputs.getIsDragging())
    console.log('BRUSH:', JSON.stringify(editor.getInstanceState().brush ?? null))
    surface.dispatchEvent(pointerEvent('pointerup', 40 + 450, 24 + 450))

    const target = node() ?? surface
    editor.setSelectedShapes([])
    surface.dispatchEvent(pointerEvent('pointerdown', 40 + 150, 24 + 150))
    console.log('DOWN ON SHAPE POINT, SELECTED:', JSON.stringify(editor.getSelectedShapeIds()))
    console.log('DOWN ON SHAPE POINT, PATH:', editor.getPath?.())
    surface.dispatchEvent(pointerEvent('pointermove', 40 + 200, 24 + 200))
    console.log('AFTER MOVE, PATH:', editor.getPath?.())
    console.log('SHAPE NOW AT:', JSON.stringify({ x: editor.getShape(id)?.x, y: editor.getShape(id)?.y }))
    surface.dispatchEvent(pointerEvent('pointerup', 40 + 200, 24 + 200))
    void target

    unmount()
    expect(true).toBe(true)
  })
})
