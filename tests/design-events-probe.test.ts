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
  surface.getBoundingClientRect = () =>
    ({ left: BOX.left, top: BOX.top, width: BOX.width, height: BOX.height, right: BOX.left + BOX.width, bottom: BOX.top + BOX.height, x: BOX.left, y: BOX.top }) as DOMRect
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

    unmount()
    expect(true).toBe(true)
  })
})
