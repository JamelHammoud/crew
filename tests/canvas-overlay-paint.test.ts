import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShape, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil, TextShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

interface Drawn {
  context: CanvasRenderingContext2D
  moves: number[][]
  lines: number
}

function recorder(): Drawn {
  const moves: number[][] = []
  let lines = 0
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
      moves.push([x, y])
    },
    lineTo: () => {
      lines += 1
    },
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    lineCap: 'butt',
    lineJoin: 'miter'
  } as unknown as CanvasRenderingContext2D
  return {
    context,
    moves,
    get lines() {
      return lines
    }
  }
}

if (!('HTMLElement' in globalThis)) {
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, writable: true, value: class {} })
}

function editor(): Editor {
  const subject = new Editor({
    store: createTLStore({ id: 'overlay-paint-probe' }),
    shapeUtils: [GeoShapeUtil, TextShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
  return subject
}

function geo(subject: Editor, id: string, x: number, y: number, w = 100, h = 60): TLShapeId {
  const shapeId = createShapeId(id)
  subject.createShape({ id: shapeId, type: 'geo', x, y, props: { w, h, geo: 'rectangle' } })
  return shapeId
}

function paint(subject: Editor): Drawn {
  const drawn = recorder()
  for (const { util, overlays } of subject.overlays.getActiveOverlayEntries()) {
    util.render(drawn.context, overlays)
  }
  return drawn
}

function countingHidden(subject: Editor): () => number {
  const original = subject.isShapeHidden.bind(subject)
  let calls = 0
  subject.isShapeHidden = (shapeOrId: TLShape | TLShapeId) => {
    calls += 1
    return original(shapeOrId)
  }
  return () => calls
}

describe('what one paint of the selection chrome costs', () => {
  it('walks the selected shapes once a frame rather than once for each thing the frame asks', () => {
    const subject = editor()
    const ids = [geo(subject, 'one', 0, 0), geo(subject, 'two', 200, 0), geo(subject, 'three', 400, 0)]
    subject.select(...ids)

    const calls = countingHidden(subject)
    paint(subject)
    const first = calls()
    expect(first).toBe(ids.length)

    paint(subject)
    expect(calls() - first).toBe(ids.length)
  })

  it('costs the same per frame however many shapes are selected', () => {
    const subject = editor()
    const ids = Array.from({ length: 40 }, (_, index) => geo(subject, `shape-${index}`, index * 120, 0))
    subject.select(...ids)

    const calls = countingHidden(subject)
    paint(subject)
    expect(calls()).toBe(ids.length)
  })
})

describe('what the selection chrome says between frames', () => {
  it('follows a selection that changed since the last frame', () => {
    const subject = editor()
    const first = geo(subject, 'one', 10, 10)
    const second = geo(subject, 'two', 500, 300)

    subject.select(first)
    expect(paint(subject).moves[0]).toEqual([10, 10])

    subject.select(second)
    expect(paint(subject).moves[0]).toEqual([500, 300])
  })

  it('follows a shape that moved since the last frame', () => {
    const subject = editor()
    const id = geo(subject, 'one', 10, 10)
    subject.select(id)
    expect(paint(subject).moves[0]).toEqual([10, 10])

    subject.updateShape({ id, type: 'geo', x: 90, y: 70 })
    expect(paint(subject).moves[0]).toEqual([90, 70])
  })

  it('answers whether it is standing without a frame having been painted', () => {
    const subject = editor()
    const id = geo(subject, 'one', 10, 10)
    const indicator = subject.overlays.getOverlayUtil('shape_indicator')

    expect(indicator.isActive()).toBe(false)
    subject.select(id)
    expect(indicator.isActive()).toBe(true)
    subject.selectNone()
    expect(indicator.isActive()).toBe(false)
  })
})

describe('outlining a shape', () => {
  it('draws every vertex of the outline', () => {
    const subject = editor()
    const id = geo(subject, 'one', 40, 20, 100, 60)
    subject.select(id)

    const drawn = paint(subject)
    expect(drawn.moves[0]).toEqual([40, 20])
    expect(drawn.lines).toBeGreaterThanOrEqual(3)
  })

  it('draws the outline where the shape stands rather than where it was drawn', () => {
    const subject = editor()
    const id = geo(subject, 'one', 0, 0, 100, 60)
    subject.updateShape({ id, type: 'geo', x: 250, y: 130 })
    subject.select(id)

    expect(paint(subject).moves[0]).toEqual([250, 130])
  })
})
