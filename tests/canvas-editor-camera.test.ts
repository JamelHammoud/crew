import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { normalizeWheel } from '../src/renderer/src/canvas/editor/events'
import { Box } from '../src/renderer/src/canvas/math'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { ArrowShapeUtil, FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

function editor() {
  const subject = new Editor({
    store: createTLStore({ id: 'editor-camera-test' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil, ArrowShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 1000, h: 800 })
  return subject
}

function geo(subject: Editor, name: string, x: number, y: number, w = 100, h = 60): TLShapeId {
  const id = createShapeId(name)
  subject.createShape({ id, type: 'geo', x, y, props: { w, h } })
  return id
}

describe('the camera', () => {
  it('converts between screen, page and viewport space', () => {
    const subject = editor()
    subject.setCamera({ x: 10, y: -5, z: 2 })
    expect(subject.screenToPage({ x: 120, y: 70 })).toMatchObject({ x: 50, y: 40 })
    expect(subject.pageToScreen({ x: 50, y: 40 })).toMatchObject({ x: 120, y: 70 })
    expect(subject.pageToViewport({ x: 50, y: 40 })).toMatchObject({ x: 120, y: 70 })
    expect(subject.getViewportPageBounds().toJson()).toMatchObject({ x: -10, y: 5, w: 500, h: 400 })
  })

  it('keeps the focal point still when the zoom it was asked for is clamped', () => {
    const subject = editor()
    const focal = { x: 200, y: 100 }
    subject.setCamera({ x: 0, y: 0, z: 1 })
    subject.zoomIn(focal)
    const zoomed = subject.pageToScreen(subject.screenToPage(focal))
    expect(zoomed.x).toBeCloseTo(focal.x, 6)
    expect(zoomed.y).toBeCloseTo(focal.y, 6)
    for (let at = 0; at < 12; at++) subject.zoomIn(focal)
    const held = subject.pageToScreen(subject.screenToPage(focal))
    expect(subject.getZoomLevel()).toBe(8)
    expect(held.x).toBeCloseTo(focal.x, 6)
    expect(held.y).toBeCloseTo(focal.y, 6)
  })

  it('steps to the nearest zoom step rather than the next one above', () => {
    const subject = editor()
    subject.setCamera({ x: 0, y: 0, z: 1.9 })
    subject.zoomIn({ x: 0, y: 0 })
    expect(subject.getZoomLevel()).toBe(4)
    subject.setCamera({ x: 0, y: 0, z: 2.1 })
    subject.zoomOut({ x: 0, y: 0 })
    expect(subject.getZoomLevel()).toBe(1)
  })

  it('fits the page, centres a point and pans by a screen offset', () => {
    const subject = editor()
    geo(subject, 'left', 0, 0, 200, 200)
    geo(subject, 'right', 600, 400, 200, 200)
    subject.zoomToFit()
    expect(subject.getViewportPageBounds().contains(new Box(0, 0, 800, 600))).toBe(true)
    subject.centerOnPoint({ x: 400, y: 300 })
    expect(subject.getViewportPageBounds().center.x).toBeCloseTo(400, 6)
    expect(subject.getViewportPageBounds().center.y).toBeCloseTo(300, 6)
    const before = subject.getCamera()
    subject.pan({ x: 20, y: 10 })
    expect(subject.getCamera().x).toBeCloseTo(before.x + 20 / before.z, 6)
  })

  it('zooms the selection to the whole viewport only when it is already at a hundred per cent', () => {
    const subject = editor()
    const id = geo(subject, 'one', 0, 0, 100, 100)
    subject.select(id)
    subject.setCamera({ x: 0, y: 0, z: 1 })
    subject.zoomToSelection()
    expect(subject.getZoomLevel()).toBeGreaterThan(1)
    subject.setCamera({ x: 0, y: 0, z: 4 })
    subject.zoomToSelection()
    expect(subject.getZoomLevel()).toBe(1)
  })

  it('reads a wheel the way tldraw does, clamped and negated', () => {
    expect(normalizeWheel({ deltaX: 12, deltaY: 30 } as WheelEvent)).toEqual({ x: -12, y: -30, z: -0 })
    const zooming = normalizeWheel({ deltaX: 0, deltaY: 400, ctrlKey: true } as WheelEvent)
    expect(zooming.z).toBeCloseTo(-0.1, 6)
  })

  it('interpolates the viewport box rather than the zoom while it animates', () => {
    const subject = editor()
    subject.setCamera({ x: 0, y: 0, z: 1 })
    subject.setCamera({ x: -400, y: -300, z: 4 }, { animation: { duration: 100 } })
    expect(subject.getZoomLevel()).toBe(1)
    subject.tickForTest(50)
    const half = subject.getViewportPageBounds()
    expect(subject.getZoomLevel()).toBeGreaterThan(1)
    expect(subject.getZoomLevel()).toBeLessThan(4)
    expect(half.w).toBeCloseTo(subject.getViewportScreenBounds().w / subject.getZoomLevel(), 6)
    subject.tickForTest(100)
    expect(subject.getZoomLevel()).toBeCloseTo(4, 6)
    expect(subject.getViewportPageBounds().x).toBeCloseTo(400, 6)
  })

  it('says it is moving while the camera moves and settles back to idle', () => {
    const subject = editor()
    expect(subject.getCameraState()).toBe('idle')
    subject.setCamera({ x: 40, y: 0, z: 1 })
    expect(subject.getCameraState()).toBe('moving')
    subject.tickForTest(200)
    expect(subject.getCameraState()).toBe('idle')
  })
})
