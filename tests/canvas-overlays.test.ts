import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { Vec } from '../src/renderer/src/canvas/math'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import {
  FrameShapeUtil,
  GeoShapeUtil,
  GroupShapeUtil,
  TextShapeUtil
} from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

type Call = { name: string; args: number[] }

interface Recorder {
  context: CanvasRenderingContext2D
  calls: Call[]
  widths: number[]
  strokes: string[]
  named(name: string): Call[]
}

function recorder(): Recorder {
  const calls: Call[] = []
  const widths: number[] = []
  const strokes: string[] = []
  const note =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args: args.filter(value => typeof value === 'number') as number[] })
    }
  const context = {
    save: note('save'),
    restore: note('restore'),
    translate: note('translate'),
    rotate: note('rotate'),
    scale: note('scale'),
    transform: note('transform'),
    setTransform: note('setTransform'),
    clearRect: note('clearRect'),
    strokeRect: note('strokeRect'),
    fillRect: note('fillRect'),
    beginPath: note('beginPath'),
    closePath: note('closePath'),
    moveTo: note('moveTo'),
    lineTo: note('lineTo'),
    arc: note('arc'),
    roundRect: note('roundRect'),
    setLineDash: note('setLineDash'),
    fill: note('fill'),
    stroke: note('stroke'),
    set lineWidth(value: number) {
      widths.push(value)
    },
    get lineWidth() {
      return widths[widths.length - 1] ?? 0
    },
    set strokeStyle(value: string) {
      strokes.push(value)
    },
    get strokeStyle() {
      return strokes[strokes.length - 1] ?? ''
    },
    fillStyle: '',
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1
  } as unknown as CanvasRenderingContext2D
  return {
    context,
    calls,
    widths,
    strokes,
    named: name => calls.filter(call => call.name === name)
  }
}

if (!('HTMLElement' in globalThis)) {
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, writable: true, value: class {} })
}

function editor(): Editor {
  const subject = new Editor({
    store: createTLStore({ id: 'overlay-probe' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil, TextShapeUtil],
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

function paint(subject: Editor): Recorder {
  const drawn = recorder()
  for (const { util, overlays } of subject.overlays.getActiveOverlayEntries()) {
    drawn.context.save()
    util.render(drawn.context, overlays)
    drawn.context.restore()
  }
  return drawn
}

function activeTypes(subject: Editor): string[] {
  return subject.overlays
    .getActiveOverlayEntries()
    .map(entry => (entry.util.constructor as { type?: string }).type ?? '')
}

function handlesOf(subject: Editor): string[] {
  const util = subject.overlays.getOverlayUtil('selection_foreground')
  return (util.getOverlays?.() ?? []).map(overlay => (overlay.props as { handle: string }).handle)
}

describe('what the canvas draws over the artwork', () => {
  it('draws the box, the four corners and the four rotate targets for one selected shape', () => {
    const subject = editor()
    const id = geo(subject, 'one', 100, 100, 200, 120)
    subject.select(id)

    const drawn = paint(subject)
    const box = drawn.named('strokeRect').find(call => call.args[2] === 200 && call.args[3] === 120)
    expect(box).toBeTruthy()
    expect(box?.args.slice(0, 2)).toEqual([0, 0])

    const translate = drawn.named('translate')[0]
    expect(translate.args).toEqual([100, 100])

    const handleSize = 8
    const corners = drawn.named('fillRect').map(call => call.args.slice(0, 2))
    expect(corners).toEqual([
      [-handleSize / 2, -handleSize / 2],
      [200 - handleSize / 2, -handleSize / 2],
      [200 - handleSize / 2, 120 - handleSize / 2],
      [-handleSize / 2, 120 - handleSize / 2]
    ])

    expect(handlesOf(subject).sort()).toEqual(
      [
        'bottom',
        'bottom_left',
        'bottom_left_rotate',
        'bottom_right',
        'bottom_right_rotate',
        'left',
        'right',
        'top',
        'top_left',
        'top_left_rotate',
        'top_right',
        'top_right_rotate'
      ].sort()
    )
  })

  it('draws one box around a selection of several shapes', () => {
    const subject = editor()
    const first = geo(subject, 'one', 0, 0, 100, 100)
    const second = geo(subject, 'two', 300, 200, 100, 100)
    subject.select(first, second)

    const drawn = paint(subject)
    expect(drawn.named('translate')[0].args).toEqual([0, 0])
    expect(drawn.named('strokeRect').some(call => call.args[2] === 400 && call.args[3] === 300)).toBe(true)
  })

  it('turns the box with a rotated shape rather than boxing it upright', () => {
    const subject = editor()
    const id = geo(subject, 'one', 100, 100, 200, 100)
    subject.updateShape({ id, type: 'geo', rotation: Math.PI / 4 })
    subject.select(id)

    const drawn = paint(subject)
    expect(drawn.named('rotate')[0].args[0]).toBeCloseTo(Math.PI / 4, 6)
    expect(drawn.named('strokeRect').some(call => call.args[2] === 200 && call.args[3] === 100)).toBe(true)
  })

  it('outlines the shape under the pointer along its own edges rather than its box', () => {
    const subject = editor()
    const id = geo(subject, 'one', 40, 20, 100, 60)
    subject.setHoveredShape(id)

    const indicator = subject.overlays.getOverlayUtil('shape_indicator')
    expect(indicator.isActive()).toBe(true)
    const drawn = recorder()
    indicator.render(drawn.context, indicator.getOverlays?.() ?? [])
    expect(drawn.named('strokeRect').length).toBe(0)
    expect(drawn.named('moveTo')[0].args).toEqual([40, 20])
    expect(drawn.named('lineTo').length).toBeGreaterThanOrEqual(3)
    expect(drawn.named('closePath').length).toBe(1)
    expect(drawn.named('stroke').length).toBe(1)
  })

  it('keeps the outline on a shape standing inside a frame', () => {
    const subject = editor()
    const frameId = createShapeId('frame')
    subject.createShape({ id: frameId, type: 'frame', x: 0, y: 0, props: { w: 400, h: 400, name: 'F' } })
    const childId = geo(subject, 'child', 40, 40, 80, 80)
    subject.reparentShapes([childId], frameId)
    subject.select(childId)

    const drawn = paint(subject)
    expect(drawn.named('strokeRect').some(call => call.args[2] === 80 && call.args[3] === 80)).toBe(true)
    expect(drawn.named('translate')[0].args).toEqual([40, 40])
  })

  it('boxes the group rather than the shapes inside it', () => {
    const subject = editor()
    const first = geo(subject, 'one', 0, 0, 100, 100)
    const second = geo(subject, 'two', 200, 0, 100, 100)
    subject.select(first, second)
    subject.groupShapes([first, second])

    const drawn = paint(subject)
    expect(drawn.named('strokeRect').some(call => call.args[2] === 300 && call.args[3] === 100)).toBe(true)
  })

  it('takes the handles off a shape while it is being written in', () => {
    const subject = editor()
    const id = geo(subject, 'labelled', 10, 10, 120, 80)
    subject.select(id)
    expect(activeTypes(subject)).toContain('selection_foreground')

    subject.setEditingShape(id)
    expect(activeTypes(subject)).not.toContain('selection_foreground')
    expect(activeTypes(subject)).not.toContain('shape_handle')
    expect(paint(subject).named('strokeRect').length).toBe(0)
  })

  it('holds every stroke to one screen pixel however far in the camera is', () => {
    const subject = editor()
    const id = geo(subject, 'one', 100, 100, 200, 120)
    subject.select(id)
    subject.setCamera({ x: 0, y: 0, z: 4 })

    const drawn = paint(subject)
    for (const width of drawn.widths) expect(width * 4).toBeCloseTo(width * 4, 6)
    expect(drawn.widths.every(width => width <= 1.5 / 4 + 1e-9)).toBe(true)

    const handleSize = 8 / 4
    const corner = drawn.named('fillRect')[0]
    expect(corner.args[2]).toBeCloseTo(handleSize, 6)
  })

  it('drops to two corners and no edges on a shape narrower than two handles', () => {
    const subject = editor()
    const id = geo(subject, 'thin', 0, 0, 10, 200)
    subject.select(id)

    const drawn = paint(subject)
    expect(drawn.named('fillRect').map(call => call.args.slice(0, 2))).toEqual([
      [-4, -4],
      [10 - 4, 200 - 4]
    ])
    expect(handlesOf(subject)).toEqual(['top_left', 'bottom_right'])
  })

  it('leaves one corner and no rotate targets on a shape smaller than a handle both ways', () => {
    const subject = editor()
    const id = geo(subject, 'speck', 0, 0, 10, 10)
    subject.select(id)

    const drawn = paint(subject)
    expect(drawn.named('fillRect').length).toBe(1)
    expect(handlesOf(subject)).toEqual(['top_left'])
  })

  it('draws the marquee as a filled rectangle in page space', () => {
    const subject = editor()
    subject.updateInstanceState({ brush: { x: 20, y: 30, w: 120, h: 80 } })

    expect(activeTypes(subject)).toContain('brush')
    const drawn = paint(subject)
    expect(drawn.named('fillRect')[0].args).toEqual([20, 30, 120, 80])
    expect(drawn.named('strokeRect')[0].args).toEqual([20, 30, 120, 80])
  })

  it('draws the eraser scribble as one run of line', () => {
    const subject = editor()
    subject.updateInstanceState({
      scribbles: [
        {
          id: 'scribble:one',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 20, y: 0 }
          ],
          size: 8,
          color: 'muted-1',
          opacity: 0.8,
          state: 'active',
          delay: 0,
          shrink: 0,
          taper: false
        }
      ]
    })

    expect(activeTypes(subject)).toContain('scribble')
    const drawn = paint(subject)
    expect(drawn.named('moveTo')[0].args).toEqual([0, 0])
    expect(drawn.named('lineTo').map(call => call.args)).toEqual([
      [10, 10],
      [20, 0]
    ])
    expect(drawn.named('stroke').length).toBe(1)
  })

  it('draws a snap line between the points it snapped to', () => {
    const subject = editor()
    const first = geo(subject, 'one', 0, 0, 100, 100)
    geo(subject, 'two', 0, 200, 100, 100)
    subject.select(first)
    subject.snaps.setIndicators([
      { id: 'snap:one', type: 'points', points: [new Vec(50, 50), new Vec(50, 250)] }
    ])

    expect(activeTypes(subject)).toContain('snap_indicator')
    const drawn = paint(subject)
    expect(drawn.named('moveTo')[0].args).toEqual([50, 50])
    expect(drawn.named('lineTo')[0].args).toEqual([50, 250])
    expect(drawn.named('stroke').length).toBeGreaterThan(0)
  })

  it('marks each point a snap landed on', () => {
    const subject = editor()
    const id = geo(subject, 'one', 0, 0, 100, 100)
    subject.select(id)
    subject.snaps.setIndicators([
      { id: 'snap:one', type: 'points', points: [new Vec(0, 0), new Vec(100, 0)] }
    ])

    const drawn = paint(subject)
    const marks = drawn.named('moveTo').filter(call => call.args.length === 2)
    expect(marks.length).toBeGreaterThanOrEqual(1)
    expect(drawn.named('setLineDash').length).toBeGreaterThan(0)
  })

  it('paints the marquee under the chrome that stands over it', () => {
    const subject = editor()
    const id = geo(subject, 'one', 100, 100, 200, 120)
    subject.select(id)
    subject.setHoveredShape(id)
    subject.updateInstanceState({ brush: { x: 0, y: 0, w: 10, h: 10 } })

    const types = activeTypes(subject)
    expect(types.indexOf('brush')).toBeGreaterThanOrEqual(0)
    expect(types.indexOf('brush')).toBeLessThan(types.indexOf('selection_foreground'))
  })
})
