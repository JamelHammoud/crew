import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil, GroupShapeUtil, defaultBindingUtils } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Drawn {
  rects: Rect[]
  lines: Array<{ x: number; y: number }>
}

const drawn: Drawn = { rects: [], lines: [] }
const painted: Rect[] = []

class Recorder {
  readonly own: Rect[] = []

  rect(x: number, y: number, w: number, h: number): void {
    this.own.push({ x, y, w, h })
    drawn.rects.push({ x, y, w, h })
  }
  addPath(path: Recorder): void {
    painted.push(...path.own)
  }
  moveTo(x: number, y: number): void {
    drawn.lines.push({ x, y })
  }
  lineTo(x: number, y: number): void {
    drawn.lines.push({ x, y })
  }
  ellipse(): void {}
  roundRect(): void {}
  closePath(): void {}
}

const had = (globalThis as { Path2D?: unknown }).Path2D

beforeEach(() => {
  drawn.rects = []
  drawn.lines = []
  painted.length = 0
  ;(globalThis as { Path2D?: unknown }).Path2D = Recorder
})

afterEach(() => {
  if (had) (globalThis as { Path2D?: unknown }).Path2D = had
  else delete (globalThis as { Path2D?: unknown }).Path2D
})

function board() {
  const subject = new Editor({
    store: createTLStore({ id: 'group-indicator' }),
    shapeUtils: [GeoShapeUtil, GroupShapeUtil],
    bindingUtils: defaultBindingUtils,
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 1000, h: 800 })
  return subject
}

function grouped(subject: Editor, gap = 100): TLShapeId {
  for (const [name, x] of [
    ['one', 0],
    ['two', 100 + gap]
  ] as const) {
    subject.createShape({ id: createShapeId(name), type: 'geo', x, y: 0, props: { w: 100, h: 100 } })
  }
  subject.groupShapes([createShapeId('one'), createShapeId('two')])
  return subject.getSelectedShapeIds()[0]
}

function outline(subject: Editor, id: TLShapeId): Drawn {
  const shape = subject.getShape(id)!
  subject.getShapeUtil(shape).getIndicatorPath?.(shape)
  return drawn
}

function paint(subject: Editor): Rect[] {
  painted.length = 0
  const context = {
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    clearRect: () => {},
    strokeRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {}
  } as unknown as CanvasRenderingContext2D
  for (const { util, overlays } of subject.overlays.getActiveOverlayEntries()) {
    if ((util.constructor as { type?: string }).type !== 'shape_indicator') continue
    util.render(context, overlays)
  }
  return painted
}

describe('the outline around a selected group', () => {
  it('draws one box around the whole group', () => {
    const subject = board()
    const group = grouped(subject)
    expect(outline(subject, group).rects).toEqual([{ x: 0, y: 0, w: 300, h: 100 }])
  })

  it('never outlines the shapes inside it', () => {
    const subject = board()
    const group = grouped(subject)
    const shown = outline(subject, group)
    expect(shown.rects.length).toBe(1)
    expect(shown.lines).toEqual([])
  })

  it('holds one box however many shapes are in the group', () => {
    const subject = board()
    for (const [name, x] of [
      ['a', 0],
      ['b', 200],
      ['c', 400],
      ['d', 600]
    ] as const) {
      subject.createShape({ id: createShapeId(name), type: 'geo', x, y: 0, props: { w: 100, h: 100 } })
    }
    subject.groupShapes(['a', 'b', 'c', 'd'].map(name => createShapeId(name)))
    const group = subject.getSelectedShapeIds()[0]
    expect(outline(subject, group).rects).toEqual([{ x: 0, y: 0, w: 700, h: 100 }])
  })

  it('leaves the box solid rather than breaking it into dashes', () => {
    const subject = board()
    const group = grouped(subject)
    expect(outline(subject, group).lines.length).toBe(0)
  })

  it('draws nothing on the canvas for the group itself', () => {
    const subject = board()
    const group = grouped(subject)
    const shape = subject.getShape(group)!
    const painted = subject.getShapeUtil(shape).component(shape) as { props?: { children?: unknown } }
    expect(painted?.props?.children).toBeUndefined()
  })

  it('follows a shape that has moved inside it', () => {
    const subject = board()
    const group = grouped(subject)
    expect(paint(subject)).toEqual([{ x: 0, y: 0, w: 300, h: 100 }])

    subject.updateShape({ id: createShapeId('two'), type: 'geo', x: 400 })
    expect(paint(subject)).toEqual([{ x: 0, y: 0, w: 500, h: 100 }])
    expect(subject.getShapePageBounds(group)?.w).toBe(500)
  })

  it('follows a shape that has grown inside it', () => {
    const subject = board()
    grouped(subject)
    expect(paint(subject)).toEqual([{ x: 0, y: 0, w: 300, h: 100 }])

    subject.updateShape({ id: createShapeId('two'), type: 'geo', props: { h: 400 } })
    expect(paint(subject)).toEqual([{ x: 0, y: 0, w: 300, h: 400 }])
  })

  it('closes up again when a shape leaves it', () => {
    const subject = board()
    for (const [name, x] of [
      ['a', 0],
      ['b', 200],
      ['c', 400]
    ] as const) {
      subject.createShape({ id: createShapeId(name), type: 'geo', x, y: 0, props: { w: 100, h: 100 } })
    }
    subject.groupShapes(['a', 'b', 'c'].map(name => createShapeId(name)))
    expect(paint(subject)).toEqual([{ x: 0, y: 0, w: 500, h: 100 }])

    subject.deleteShapes([createShapeId('c')])
    expect(paint(subject)).toEqual([{ x: 0, y: 0, w: 300, h: 100 }])
  })

  it('keeps the selection box and its handles for a group', () => {
    const subject = board()
    const group = grouped(subject)
    const shape = subject.getShape(group)!
    expect(subject.getShapeUtil(shape).hideSelectionBoundsFg?.(shape as never)).toBeFalsy()
  })
})
