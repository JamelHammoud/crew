import { describe, expect, it } from 'vitest'
import { encodePoints } from '../src/renderer/src/canvas/schema/points'
import type { TLShape, TLShapeId, TLShapeType } from '../src/renderer/src/canvas/schema'
import {
  ArrowShapeUtil,
  DrawShapeUtil,
  FrameShapeUtil,
  GeoShapeUtil,
  GroupShapeUtil,
  HighlightShapeUtil,
  ImageShapeUtil,
  LineShapeUtil,
  NoteShapeUtil,
  type ShapeEditor,
  type ShapeUtil
} from '../src/renderer/src/canvas/shapes'

const editor: ShapeEditor = {}

const base = {
  typeName: 'shape' as const,
  x: 0,
  y: 0,
  rotation: 0,
  index: 'a1' as TLShape['index'],
  parentId: 'page:page' as TLShape['parentId'],
  isLocked: false,
  opacity: 1,
  meta: {}
}

function shape<Type extends TLShapeType>(type: Type, props: TLShape<Type>['props']): TLShape<Type> {
  return { ...base, id: `shape:${type}` as TLShapeId, type, props } as TLShape<Type>
}

function strokeShape(type: 'draw' | 'highlight', points: number[][]) {
  const util = type === 'draw' ? new DrawShapeUtil(editor) : new HighlightShapeUtil(editor)
  const encoded = points.map(([x, y]) => ({ x, y, z: 0.5 }))
  return shape(type, {
    ...(util.getDefaultProps() as Record<string, unknown>),
    segments: [{ type: 'free', path: encodePoints(encoded), dim: 3 }]
  } as never)
}

describe('what each shape lets you do to it', () => {
  it('never draws a resize or rotate handle on an arrow, a line or a group', () => {
    const arrow = new ArrowShapeUtil(editor)
    const line = new LineShapeUtil(editor)
    const group = new GroupShapeUtil(editor)
    const any = null as never
    expect([arrow.hideResizeHandles(any), arrow.hideRotateHandle(any)]).toEqual([true, true])
    expect([arrow.hideSelectionBoundsBg(any), arrow.hideSelectionBoundsFg(any)]).toEqual([true, true])
    expect([line.hideResizeHandles(any), line.hideRotateHandle(any)]).toEqual([true, true])
    expect([line.hideSelectionBoundsBg(any), line.hideSelectionBoundsFg(any)]).toEqual([true, true])
    expect(group.hideSelectionBoundsFg(any)).toBe(true)
  })

  it('will not bind an arrow to another arrow or to a group', () => {
    expect(new ArrowShapeUtil(editor).canBind(null as never)).toBe(false)
    expect(new GroupShapeUtil(editor).canBind(null as never)).toBe(false)
    expect(new GeoShapeUtil(editor).canBind(null as never)).toBe(true)
    expect(new NoteShapeUtil(editor).canBind(null as never)).toBe(true)
  })

  it('never snaps to an arrow', () => {
    expect(new ArrowShapeUtil(editor).canSnap(null as never)).toBe(false)
    expect(new GeoShapeUtil(editor).canSnap(null as never)).toBe(true)
  })

  it('takes the handles off a stroke that is only a dot', () => {
    const draw = new DrawShapeUtil(editor)
    const dot = strokeShape('draw', [[0, 0]])
    const line = strokeShape('draw', [
      [0, 0],
      [30, 20],
      [60, 0]
    ])
    expect([draw.hideResizeHandles(dot), draw.hideRotateHandle(dot), draw.hideSelectionBoundsFg(dot)]).toEqual([
      true,
      true,
      true
    ])
    expect([draw.hideResizeHandles(line), draw.hideRotateHandle(line), draw.hideSelectionBoundsFg(line)]).toEqual([
      false,
      false,
      false
    ])
  })

  it('holds a highlighter to the same rule', () => {
    const util = new HighlightShapeUtil(editor)
    expect(util.hideResizeHandles(strokeShape('highlight', [[0, 0]]) as never)).toBe(true)
    expect(
      util.hideResizeHandles(
        strokeShape('highlight', [
          [0, 0],
          [40, 40]
        ]) as never
      )
    ).toBe(false)
  })

  it('lets text be typed into the shapes that carry words', () => {
    const canEdit: [string, ShapeUtil][] = [
      ['geo', new GeoShapeUtil(editor)],
      ['note', new NoteShapeUtil(editor)],
      ['arrow', new ArrowShapeUtil(editor)],
      ['line', new LineShapeUtil(editor)],
      ['draw', new DrawShapeUtil(editor)],
      ['frame', new FrameShapeUtil(editor)]
    ] as [string, ShapeUtil][]
    for (const [name, util] of canEdit) expect(util.canEdit(null as never), name).toBe(true)
    expect(new ImageShapeUtil(editor).canEdit(null as never)).toBe(false)
    expect(new GroupShapeUtil(editor).canEdit(null as never)).toBe(false)
  })

  it('keeps a picture and a frame as their own export bounds', () => {
    expect(new ImageShapeUtil(editor).isExportBoundsContainer()).toBe(true)
    expect(new FrameShapeUtil(editor).isExportBoundsContainer()).toBe(true)
    expect(new GeoShapeUtil(editor).isExportBoundsContainer(null as never)).toBe(false)
  })

  it('leaves the children of a frame alone while the frame is dragged bigger', () => {
    const frame = new FrameShapeUtil(editor)
    expect(frame.canResizeChildren()).toBe(false)
    const Resizing = FrameShapeUtil.configure({ resizeChildren: true })
    expect(new Resizing(editor).canResizeChildren(null as never)).toBe(true)
    expect(new GroupShapeUtil(editor).canResizeChildren()).toBe(true)
  })

  it('reads a picture out to whoever cannot see it', () => {
    const util = new ImageShapeUtil(editor)
    const picture = shape('image', { ...util.getDefaultProps(), altText: 'a cat asleep on a keyboard' })
    expect(util.getAriaDescriptor(picture)).toBe('a cat asleep on a keyboard')
  })

  it('locks a picture to its own proportions and lets it be cropped', () => {
    const util = new ImageShapeUtil(editor)
    expect(util.isAspectRatioLocked(null as never)).toBe(true)
    expect(util.canCrop(null as never)).toBe(true)
    expect(new GeoShapeUtil(editor).canCrop(null as never)).toBe(false)
  })
})
