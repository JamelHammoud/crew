import { describe, expect, it } from 'vitest'
import { Editor } from '/Users/jamel/Documents/Repositories/crew/src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '/Users/jamel/Documents/Repositories/crew/src/renderer/src/canvas/schema'
import { FrameShapeUtil, GroupShapeUtil } from '/Users/jamel/Documents/Repositories/crew/src/renderer/src/canvas/shapes'
import { SelectTool } from '/Users/jamel/Documents/Repositories/crew/src/renderer/src/canvas/tools/select'

describe('overlay hit test', () => {
  it('reports which handle the bottom right corner resolves to at board zoom', () => {
    const subject = new Editor({
      store: createTLStore({ id: 'overlay-probe' }),
      shapeUtils: [FrameShapeUtil, GroupShapeUtil],
      tools: [SelectTool],
      getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
    })
    subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
    const id = createShapeId('one')
    subject.createShape({ id, type: 'frame', x: 0, y: 0, props: { w: 125, h: 129, name: 'a', color: 'black' } })
    subject.select(id)
    subject.setCamera({ x: 0, y: 0, z: 0.145 }, { immediate: true })
    const margin = 8 / subject.getZoomLevel()
    const corner = { x: 125, y: 129 }
    const hit: any = subject.overlays.getOverlayAtPoint(corner, margin)
    console.log('zoom', subject.getZoomLevel(), 'margin', margin.toFixed(1))
    console.log('handle at the bottom right corner:', hit?.props?.handle ?? '(none)')
    const points: string[] = []
    for (const entry of (subject.overlays as any).getActiveOverlayEntries()) {
      for (const o of entry.overlays) if (o.props?.handle) points.push(o.props.handle)
    }
    console.log('handles offered:', points.join(', '))
    expect(hit).toBeTruthy()
  })
})
