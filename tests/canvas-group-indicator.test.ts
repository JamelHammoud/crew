import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil, GroupShapeUtil, defaultBindingUtils } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

const drawn: Array<{ x: number; y: number }> = []

class Recorder {
  moveTo(x: number, y: number): void {
    drawn.push({ x, y })
  }
  lineTo(x: number, y: number): void {
    drawn.push({ x, y })
  }
}

const had = (globalThis as { Path2D?: unknown }).Path2D

beforeEach(() => {
  drawn.length = 0
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

function grouped(subject: Editor): TLShapeId {
  for (const [name, x] of [
    ['one', 0],
    ['two', 200]
  ] as const) {
    subject.createShape({ id: createShapeId(name), type: 'geo', x, y: 0, props: { w: 100, h: 100 } })
  }
  subject.groupShapes([createShapeId('one'), createShapeId('two')])
  return subject.getSelectedShapeIds()[0]
}

function pathOf(subject: Editor, id: TLShapeId): Array<{ x: number; y: number }> {
  const shape = subject.getShape(id)!
  subject.getShapeUtil(shape).getIndicatorPath?.(shape)
  return drawn
}

const onPerimeter = (point: { x: number; y: number }, box: { w: number; h: number }): boolean =>
  Math.abs(point.x) < 0.01 ||
  Math.abs(point.x - box.w) < 0.01 ||
  Math.abs(point.y) < 0.01 ||
  Math.abs(point.y - box.h) < 0.01

describe('the outline around a selected group', () => {
  it('traces the bounds of the group and never the shapes inside it', () => {
    const subject = board()
    const group = grouped(subject)
    const points = pathOf(subject, group)
    expect(points.length).toBeGreaterThan(0)
    for (const point of points) expect(onPerimeter(point, { w: 300, h: 100 }), `${point.x},${point.y}`).toBe(true)
  })

  it('never draws along the gap between two shapes in the group', () => {
    const subject = board()
    const group = grouped(subject)
    const points = pathOf(subject, group)
    expect(points.some(point => Math.abs(point.x - 100) < 0.01 || Math.abs(point.x - 200) < 0.01)).toBe(false)
  })

  it('reaches both far corners of the group', () => {
    const subject = board()
    const group = grouped(subject)
    const points = pathOf(subject, group)
    expect(Math.max(...points.map(point => point.x))).toBeCloseTo(300, 1)
    expect(Math.max(...points.map(point => point.y))).toBeCloseTo(100, 1)
  })

  it('breaks the outline into dashes rather than four straight sides', () => {
    const subject = board()
    const group = grouped(subject)
    expect(pathOf(subject, group).length).toBeGreaterThan(8)
  })
})

function painted(subject: Editor, id: TLShapeId): { name: unknown; sides: number } {
  const shape = subject.getShape(id)!
  const drawing = subject.getShapeUtil(shape).component(shape) as {
    type: string
    props: { className?: string; children?: unknown }
  }
  const children = drawing?.props?.children
  return {
    name: drawing?.props?.className ?? drawing?.type,
    sides: Array.isArray(children) ? children.length : 0
  }
}

describe('the outline drawn on the canvas for a group', () => {
  it('draws nothing while the group is simply sitting there', () => {
    const subject = board()
    const group = grouped(subject)
    expect(painted(subject, group).sides).toBe(0)
  })

  it('outlines the group once you have gone inside it', () => {
    const subject = board()
    const group = grouped(subject)
    subject.setFocusedGroup(group)
    const shown = painted(subject, group)
    expect(shown.name).toBe('crew-group-outline')
    expect(shown.sides).toBe(4)
  })

  it('outlines the group while it is being rubbed out', () => {
    const subject = board()
    const group = grouped(subject)
    subject.setErasingShapes([group])
    expect(painted(subject, group).sides).toBe(4)
  })
})
