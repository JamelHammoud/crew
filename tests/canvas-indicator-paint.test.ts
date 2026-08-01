import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil, TextShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

const built = { paths: 0 }
const placed: Array<[number, number]> = []

class CountedPath {
  constructor(_d?: string) {
    built.paths += 1
  }

  addPath(_path: unknown, transform?: { e?: number; f?: number }): void {
    placed.push([transform?.e ?? 0, transform?.f ?? 0])
  }

  ellipse(): void {}
  roundRect(): void {}
  rect(): void {}
  moveTo(): void {}
  lineTo(): void {}
  closePath(): void {}
}

if (!('HTMLElement' in globalThis)) {
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, writable: true, value: class {} })
}

Object.defineProperty(globalThis, 'Path2D', { configurable: true, writable: true, value: CountedPath })

interface Painted {
  strokes: number
  traced: Array<[number, number]>
}

function editor(): Editor {
  const subject = new Editor({
    store: createTLStore({ id: 'indicator-paint-probe' }),
    shapeUtils: [GeoShapeUtil, TextShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
  return subject
}

function geo(subject: Editor, id: string, x: number, y: number, locked = false): TLShapeId {
  const shapeId = createShapeId(id)
  subject.createShape({ id: shapeId, type: 'geo', x, y, isLocked: locked, props: { w: 16, h: 16, geo: 'rectangle' } })
  return shapeId
}

function paint(subject: Editor): Painted {
  placed.length = 0
  let strokes = 0
  const traced: Array<[number, number]> = []
  const context = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    setTransform: () => {},
    clearRect: () => {},
    strokeRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: (x: number, y: number) => {
      traced.push([x, y])
    },
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {
      strokes += 1
    },
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    lineCap: 'butt',
    lineJoin: 'miter'
  } as unknown as CanvasRenderingContext2D
  for (const { util, overlays } of subject.overlays.getActiveOverlayEntries()) {
    util.render(context, overlays)
  }
  return { strokes, traced }
}

function board(subject: Editor, onScreen: number, offScreen: number): TLShapeId[] {
  const ids: TLShapeId[] = []
  for (let index = 0; index < onScreen; index++) ids.push(geo(subject, `near-${index}`, index * 20, 40))
  for (let index = 0; index < offScreen; index++) ids.push(geo(subject, `far-${index}`, 4000 + index * 40, 40))
  return ids
}

describe('what one frame of outlines really strokes', () => {
  it('leaves the shapes standing off the screen alone', () => {
    const subject = editor()
    const ids = board(subject, 30, 170)
    subject.select(...ids)

    paint(subject)
    expect(ids.length).toBe(200)
    expect(placed.length).toBe(30)
    const viewport = subject.getViewportPageBounds()
    expect(placed.every(([x]) => x >= viewport.minX && x <= viewport.maxX)).toBe(true)
  })

  it('outlines a shape as the camera reaches it', () => {
    const subject = editor()
    const ids = board(subject, 30, 170)
    subject.select(...ids)

    paint(subject)
    expect(placed.length).toBe(30)

    subject.setCamera({ x: -4000, y: 0, z: 1 })
    paint(subject)
    expect(placed.length).toBe(20)
    expect(placed.every(([x]) => x >= 4000)).toBe(true)
  })

  it('leaves a locked shape alone', () => {
    const subject = editor()
    const open = geo(subject, 'open', 100, 100)
    const shut = geo(subject, 'shut', 300, 100, true)
    subject.select(open, shut)

    paint(subject)
    expect(placed).toEqual([[100, 100]])
  })

  it('says nothing at all when everything selected is locked', () => {
    const subject = editor()
    const shut = geo(subject, 'shut', 300, 100, true)
    subject.select(shut)

    const drawn = paint(subject)
    expect(placed).toEqual([])
    expect(subject.overlays.getOverlayUtil('shape_indicator').isActive()).toBe(false)
    expect(drawn.traced).toEqual([])
  })

  it('strokes the whole set once rather than once a shape', () => {
    const subject = editor()
    const ids = board(subject, 30, 0)
    subject.select(...ids)

    expect(paint(subject).strokes).toBe(1)
  })
})

describe('what a drag costs after the first frame of it', () => {
  it('builds one path a shape however many frames it is dragged for', () => {
    const subject = editor()
    const ids = board(subject, 3, 0)
    subject.select(...ids)

    const start = built.paths
    for (let frame = 0; frame < 10; frame++) {
      subject.setCamera({ x: -frame, y: 0, z: 1 })
      paint(subject)
      expect(placed.length).toBe(3)
    }
    expect(built.paths - start).toBe(13)
  })

  it('draws a shape that moved where it now stands without drawing it again', () => {
    const subject = editor()
    const id = geo(subject, 'one', 10, 10)
    subject.select(id)

    paint(subject)
    expect(placed).toEqual([[10, 10]])

    const start = built.paths
    subject.updateShape({ id, type: 'geo', x: 90, y: 70 })
    paint(subject)
    expect(placed).toEqual([[90, 70]])
    expect(built.paths - start).toBe(1)
  })

  it('draws a shape again once its own outline has changed', () => {
    const subject = editor()
    const id = geo(subject, 'one', 10, 10)
    subject.select(id)

    paint(subject)
    const start = built.paths
    subject.updateShape({ id, type: 'geo', props: { w: 300 } })
    paint(subject)
    expect(built.paths - start).toBe(2)
  })
})
