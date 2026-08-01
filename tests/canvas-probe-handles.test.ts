import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

const RESIZE = ['top_left', 'top_right', 'bottom_right', 'bottom_left', 'top', 'right', 'bottom', 'left']
const ROTATE = ['top_left_rotate', 'top_right_rotate', 'bottom_right_rotate', 'bottom_left_rotate']

function board(zoom = 1): Editor {
  const subject = new Editor({
    store: createTLStore({ id: 'handle-probe' }),
    shapeUtils: [GeoShapeUtil, GroupShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 1000, h: 800 })
  subject.setCamera({ x: 0, y: 0, z: zoom }, { immediate: true })
  return subject
}

function geo(subject: Editor, name: string, x: number, y: number, w = 200, h = 160): TLShapeId {
  const id = createShapeId(name)
  subject.createShape({ id, type: 'geo', x, y, props: { w, h, geo: 'rectangle', fill: 'solid' } })
  return id
}

function handles(subject: Editor): Array<{ handle: string; point: { x: number; y: number } }> {
  const util = subject.overlays.getOverlayUtil('selection_foreground')
  if (!util.isActive()) return []
  return (util.getOverlays?.() ?? []).map(overlay => ({
    handle: (overlay.props as { handle: string }).handle,
    point: (overlay.props as { point: { x: number; y: number } }).point
  }))
}

function under(subject: Editor, point: { x: number; y: number }): string {
  const found = subject.overlays.getOverlayAtPoint(point, subject.options.hitTestMargin / subject.getZoomLevel())
  if (!found) return 'nothing'
  return (found.props as { handle?: string }).handle ?? found.type
}

function click(subject: Editor, id: TLShapeId, point: { x: number; y: number }, shiftKey = false): void {
  const shape = subject.getShape(id)
  subject.inputs.pointerDown(point, point, { shiftKey })
  subject.dispatch({ name: 'pointer_down', target: 'shape', shape, point, shiftKey })
  subject.inputs.pointerUp(point, point, { shiftKey })
  subject.dispatch({ name: 'pointer_up', target: 'shape', shape, point, shiftKey })
}

describe('what the selection puts under the pointer', () => {
  for (const zoom of [0.25, 1, 2]) {
    it(`leaves the middle of a selected shape clear at zoom ${zoom}`, () => {
      const subject = board(zoom)
      const id = geo(subject, `middle-${zoom}`, 100, 100)
      subject.select(id)
      const bounds = subject.getShapePageBounds(id)!
      expect(under(subject, bounds.center)).toBe('nothing')
      expect(under(subject, { x: bounds.minX + 30 / zoom, y: bounds.minY + 30 / zoom })).toBe('nothing')
    })

    it(`hands back every handle it draws at zoom ${zoom}`, () => {
      const subject = board(zoom)
      const id = geo(subject, `handles-${zoom}`, 100, 100)
      subject.select(id)
      const drawn = handles(subject)
      expect(drawn.map(item => item.handle).sort()).toEqual([...RESIZE, ...ROTATE].sort())
      for (const item of drawn) expect([item.handle, under(subject, item.point)]).toEqual([item.handle, item.handle])
    })
  }

  it('takes the rotate handles away from a shape too small to grab', () => {
    const subject = board(0.05)
    const id = geo(subject, 'tiny', 100, 100)
    subject.select(id)
    const drawn = handles(subject).map(item => item.handle)
    expect(drawn.filter(handle => handle.endsWith('_rotate'))).toEqual([])
    expect(drawn.length).toBeLessThan(RESIZE.length)
  })

  it('outlines a shape that is selected', () => {
    const subject = board()
    const id = geo(subject, 'outlined', 100, 100)
    subject.select(id)
    const util = subject.overlays.getOverlayUtil('shape_indicator')
    expect(util.isActive()).toBe(true)
    const outlined = (util.getOverlays?.() ?? []).flatMap(
      overlay => (overlay.props as { indicated?: string[] }).indicated ?? []
    )
    expect(outlined).toContain(id)
  })
})

describe('shift clicking a selection', () => {
  it('adds a shape and takes it away again', () => {
    const subject = board()
    const one = geo(subject, 'one', 100, 100)
    const two = geo(subject, 'two', 400, 100)
    const middle = (id: TLShapeId) => subject.getShapePageBounds(id)!.center

    click(subject, one, middle(one))
    expect(subject.getSelectedShapeIds()).toEqual([one])

    click(subject, two, middle(two), true)
    expect(subject.getSelectedShapeIds().slice().sort()).toEqual([one, two].sort())

    click(subject, one, middle(one), true)
    expect(subject.getSelectedShapeIds()).toEqual([two])
  })
})
