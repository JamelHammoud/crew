import { afterEach, describe, expect, it, vi } from 'vitest'
import { Mat } from '../src/renderer/src/canvas/math/Mat'
import { Vec, type VecLike } from '../src/renderer/src/canvas/math/Vec'
import { ZERO_INDEX_KEY, type IndexKey } from '../src/renderer/src/canvas/schema/indices'
import type { TLShape, TLShapeId } from '../src/renderer/src/canvas/schema/records'
import { ArrowShapeTool } from '../src/renderer/src/canvas/tools/arrow'
import type {
  ArrowHandle,
  ArrowShapeCreate,
  ArrowShapeUpdate,
  ArrowTargetArgs,
  ArrowToolEditor,
  TLArrowShape
} from '../src/renderer/src/canvas/tools/arrow'
import { LineShapeTool } from '../src/renderer/src/canvas/tools/line'
import type {
  LineHandle,
  LineShapeCreate,
  LineShapeUpdate,
  LineToolEditor,
  TLLineShape
} from '../src/renderer/src/canvas/tools/line'

function lineShape(input: LineShapeCreate): TLLineShape {
  return {
    id: input.id,
    typeName: 'shape',
    type: 'line',
    x: input.x,
    y: input.y,
    rotation: 0,
    index: ZERO_INDEX_KEY,
    parentId: 'page:test',
    isLocked: false,
    opacity: 1,
    props: {
      color: 'black',
      dash: 'draw',
      size: 'm',
      spline: 'line',
      points: {
        a1: { id: 'a1', index: 'a1', x: 0, y: 0 },
        a2: { id: 'a2', index: 'a2', x: 0.1, y: 0.1 }
      },
      scale: 1,
      ...input.props
    },
    meta: {}
  } as TLLineShape
}

class LineEditor implements LineToolEditor {
  point = new Vec()
  dragging = false
  shift = false
  zoom = 1
  gridMode = false
  coarse = false
  shapes = new Map<TLShapeId, TLLineShape>()
  selected: TLShapeId | undefined
  currentTool = ''
  currentToolInfo: Record<string, unknown> | undefined
  cursor = ''
  clearCount = 0
  private marks = new Map<string, Map<TLShapeId, TLLineShape>>()
  private markCount = 0

  inputs = {
    getCurrentPagePoint: () => this.point,
    getIsDragging: () => this.dragging,
    getShiftKey: () => this.shift
  }

  snaps = {
    clearIndicators: () => {
      this.clearCount += 1
    }
  }

  getShape(id: TLShapeId): TLLineShape | undefined {
    return this.shapes.get(id)
  }

  getShapeHandles(shape: TLLineShape): LineHandle[] {
    return Object.values(shape.props.points) as LineHandle[]
  }

  getShapeParentTransform(): Mat {
    return Mat.Identity()
  }

  getZoomLevel(): number {
    return this.zoom
  }

  getResizeScaleFactor(): number {
    return 1
  }

  getInstanceState(): { isGridMode: boolean; isCoarsePointer: boolean } {
    return { isGridMode: this.gridMode, isCoarsePointer: this.coarse }
  }

  getDocumentSettings(): { gridSize: number } {
    return { gridSize: 10 }
  }

  markHistoryStoppingPoint(): string {
    const id = `mark:${this.markCount++}`
    this.marks.set(id, structuredClone(this.shapes))
    return id
  }

  createShapes(shapes: LineShapeCreate[]): void {
    for (const shape of shapes) this.shapes.set(shape.id, lineShape(shape))
  }

  updateShapes(updates: LineShapeUpdate[]): void {
    for (const update of updates) {
      const shape = this.shapes.get(update.id)
      if (shape) this.shapes.set(update.id, { ...shape, props: { ...shape.props, ...update.props } })
    }
  }

  select(id: TLShapeId): void {
    this.selected = id
  }

  bailToMark(markId: string): void {
    const snapshot = this.marks.get(markId)
    if (snapshot) this.shapes = structuredClone(snapshot)
  }

  setCurrentTool(id: string, info?: Record<string, unknown>): void {
    this.currentTool = id
    this.currentToolInfo = info
  }

  setCursor(cursor: { type: string }): void {
    this.cursor = cursor.type
  }
}

function arrowShape(input: ArrowShapeCreate): TLArrowShape {
  return {
    id: input.id,
    typeName: 'shape',
    type: 'arrow',
    x: input.x,
    y: input.y,
    rotation: 0,
    index: ZERO_INDEX_KEY,
    parentId: 'page:test',
    isLocked: false,
    opacity: 1,
    props: {
      kind: 'arc',
      labelColor: 'black',
      color: 'black',
      fill: 'none',
      dash: 'draw',
      size: 'm',
      arrowheadStart: 'none',
      arrowheadEnd: 'arrow',
      font: 'draw',
      start: { x: 0, y: 0 },
      end: { x: 0.1, y: 0.1 },
      bend: 0,
      richText: { type: 'doc', content: [] },
      labelPosition: 0.5,
      scale: 1,
      elbowMidPoint: 0.5,
      ...input.props
    },
    meta: {}
  } as TLArrowShape
}

class ArrowEditor implements ArrowToolEditor {
  origin = new Vec()
  point = new Vec()
  dragging = false
  gridMode = false
  coarse = false
  targetId: TLShapeId | undefined
  clearCount = 0
  targetUpdates: ArrowTargetArgs[] = []
  shapes = new Map<TLShapeId, TLArrowShape>()
  selected: TLShapeId | undefined
  currentTool = ''
  currentToolInfo: Record<string, unknown> | undefined
  cursor = ''
  edited = false
  private marks = new Map<string, Map<TLShapeId, TLArrowShape>>()
  private markCount = 0

  inputs = {
    getCurrentPagePoint: () => this.point,
    getOriginPagePoint: () => this.origin,
    getIsDragging: () => this.dragging
  }

  timers = {
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id)
  }

  getShape(id: TLShapeId): TLArrowShape | undefined {
    return this.shapes.get(id)
  }

  getShapeHandles(shape: TLArrowShape): ArrowHandle[] {
    return [
      { id: 'start', type: 'vertex', index: 'a1' as IndexKey, ...shape.props.start },
      { id: 'end', type: 'vertex', index: 'a2' as IndexKey, ...shape.props.end }
    ]
  }

  getShapeUtil(): ReturnType<ArrowToolEditor['getShapeUtil']> {
    return {
      options: { hoverPreciseTimeout: 300, pointingPreciseTimeout: 500 },
      onHandleDrag: (shape, info) => {
        const endpoint = info.handle.id as 'start' | 'end'
        return {
          id: shape.id,
          type: 'arrow',
          props: { [endpoint]: { x: info.handle.x, y: info.handle.y } }
        }
      }
    }
  }

  getPointInShapeSpace(shape: TLArrowShape, point: VecLike): VecLike {
    return { x: point.x - shape.x, y: point.y - shape.y }
  }

  getResizeScaleFactor(): number {
    return 1
  }

  getInstanceState(): { isGridMode: boolean; isCoarsePointer: boolean } {
    return { isGridMode: this.gridMode, isCoarsePointer: this.coarse }
  }

  getDocumentSettings(): { gridSize: number } {
    return { gridSize: 10 }
  }

  getOnlySelectedShape(): TLShape | undefined {
    return this.selected ? (this.shapes.get(this.selected) as unknown as TLShape) : undefined
  }

  canEditShape(shape: TLShape | undefined): boolean {
    return Boolean(shape)
  }

  startEditingShapeWithRichText(): void {
    this.edited = true
  }

  updateArrowTargetState(args: ArrowTargetArgs): { target: { id: TLShapeId } } | null {
    this.targetUpdates.push(args)
    return this.targetId ? { target: { id: this.targetId } } : null
  }

  clearArrowTargetState(): void {
    this.clearCount += 1
  }

  markHistoryStoppingPoint(): string {
    const id = `mark:${this.markCount++}`
    this.marks.set(id, structuredClone(this.shapes))
    return id
  }

  createShape(shape: ArrowShapeCreate): void {
    this.shapes.set(shape.id, arrowShape(shape))
  }

  updateShapes(updates: ArrowShapeUpdate[]): void {
    for (const update of updates) {
      const shape = this.shapes.get(update.id)
      if (!shape) continue
      this.shapes.set(update.id, {
        ...shape,
        x: update.x ?? shape.x,
        y: update.y ?? shape.y,
        props: { ...shape.props, ...update.props }
      })
    }
  }

  select(id: TLShapeId): void {
    this.selected = id
  }

  bailToMark(markId: string): void {
    const snapshot = this.marks.get(markId)
    if (snapshot) this.shapes = structuredClone(snapshot)
  }

  setCurrentTool(id: string, info?: Record<string, unknown>): void {
    this.currentTool = id
    this.currentToolInfo = info
  }

  setCursor(cursor: { type: string }): void {
    this.cursor = cursor.type
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('line tool hierarchy', () => {
  it('starts idle, creates on pointer down, and keeps the line on pointer up', () => {
    const editor = new LineEditor()
    editor.point.set(12, 18)
    const tool = new LineShapeTool(editor)
    expect(tool.getCurrentStateId()).toBe('line.idle')
    expect(editor.cursor).toBe('cross')
    tool.onPointerDown()
    expect(tool.getCurrentStateId()).toBe('line.pointing')
    expect(editor.shapes.size).toBe(1)
    expect(editor.selected).toBe([...editor.shapes.keys()][0])
    tool.onPointerUp()
    expect(tool.getCurrentStateId()).toBe('line.idle')
    expect(editor.shapes.size).toBe(1)
    expect(editor.clearCount).toBe(1)
  })

  it('rolls creation back on cancel and hands dragging to the select tool', () => {
    const editor = new LineEditor()
    const tool = new LineShapeTool(editor)
    tool.onPointerDown()
    editor.dragging = true
    tool.onPointerMove()
    expect(editor.currentTool).toBe('select.dragging_handle')
    expect(editor.currentToolInfo).toMatchObject({ isCreating: true, onInteractionEnd: 'line' })
    tool.onCancel()
    expect(editor.shapes.size).toBe(0)
    expect(tool.getCurrentStateId()).toBe('line.idle')
  })

  it('extends a prior line and measures merge distance in screen space', () => {
    const editor = new LineEditor()
    const tool = new LineShapeTool(editor)
    tool.onPointerDown()
    const id = editor.selected!
    const shape = editor.getShape(id)!
    editor.updateShapes([
      {
        id,
        type: 'line',
        props: {
          points: {
            a1: { id: 'a1', index: 'a1', x: 0, y: 0 },
            a2: { id: 'a2', index: 'a2', x: 10, y: 10 }
          }
        }
      }
    ])
    tool.onPointerUp()
    editor.shift = true
    editor.zoom = 0.25
    editor.point.set(shape.x + 14, shape.y + 10)
    tool.onPointerDown()
    expect(Object.keys(editor.getShape(id)!.props.points)).toHaveLength(2)
    tool.onPointerUp()
    editor.zoom = 4
    editor.point.set(shape.x + 11, shape.y + 10)
    tool.onPointerDown()
    expect(Object.keys(editor.getShape(id)!.props.points)).toHaveLength(3)
  })

  it('snaps creation and cancels coarse-pointer long presses', () => {
    const editor = new LineEditor()
    editor.gridMode = true
    editor.coarse = true
    editor.point.set(14, 16)
    const tool = new LineShapeTool(editor)
    tool.onPointerDown()
    const shape = editor.getShape(editor.selected!)!
    expect({ x: shape.x, y: shape.y }).toEqual({ x: 10, y: 20 })
    tool.onLongPress()
    expect(editor.shapes.size).toBe(0)
    expect(tool.getCurrentStateId()).toBe('line.idle')
  })
})

describe('arrow tool hierarchy', () => {
  it('starts idle, creates on pointer down, and removes a click-only arrow', () => {
    const editor = new ArrowEditor()
    const tool = new ArrowShapeTool(editor)
    expect(tool.getCurrentStateId()).toBe('arrow.idle')
    expect(editor.cursor).toBe('cross')
    tool.onPointerDown()
    expect(tool.getCurrentStateId()).toBe('arrow.pointing')
    expect(editor.shapes.size).toBe(1)
    tool.onPointerUp()
    expect(tool.getCurrentStateId()).toBe('arrow.idle')
    expect(editor.shapes.size).toBe(0)
    expect(editor.clearCount).toBeGreaterThan(0)
  })

  it('updates both handles and hands a dragged arrow to the select tool', () => {
    const editor = new ArrowEditor()
    const tool = new ArrowShapeTool(editor)
    tool.onPointerDown()
    editor.dragging = true
    editor.point.set(30, 40)
    tool.onPointerMove()
    const shape = editor.getShape(editor.selected!)!
    expect(shape.props.start).toEqual({ x: 0, y: 0 })
    expect(shape.props.end).toEqual({ x: 30, y: 40 })
    expect(editor.currentTool).toBe('select.dragging_handle')
    expect(editor.currentToolInfo).toMatchObject({ isCreating: true, onInteractionEnd: 'arrow' })
  })

  it('defers shape creation while the initial point has a binding target', () => {
    const editor = new ArrowEditor()
    editor.targetId = 'shape:target' as TLShapeId
    const tool = new ArrowShapeTool(editor)
    tool.onPointerDown()
    expect(editor.shapes.size).toBe(0)
    editor.dragging = true
    editor.point.set(20, 20)
    tool.onPointerMove()
    expect(editor.shapes.size).toBe(1)
    expect(editor.currentTool).toBe('select.dragging_handle')
  })

  it('becomes precise after hover and pointing timeouts', () => {
    vi.useFakeTimers()
    const editor = new ArrowEditor()
    editor.targetId = 'shape:target' as TLShapeId
    const tool = new ArrowShapeTool(editor)
    vi.advanceTimersByTime(300)
    expect(editor.targetUpdates.at(-1)?.isPrecise).toBe(true)
    tool.onPointerDown()
    const pointing = tool.current as { isPrecise: boolean }
    expect(pointing.isPrecise).toBe(true)
    editor.targetId = undefined
    vi.advanceTimersByTime(500)
    expect(pointing.isPrecise).toBe(true)
  })

  it('opens selected arrow text on Enter and returns to select on idle cancel', () => {
    const editor = new ArrowEditor()
    const tool = new ArrowShapeTool(editor)
    tool.onPointerDown()
    tool.onPointerUp()
    editor.createShape({
      id: 'shape:editable' as TLShapeId,
      type: 'arrow',
      x: 0,
      y: 0,
      props: {}
    })
    editor.select('shape:editable' as TLShapeId)
    tool.onKeyUp({ key: 'Enter' })
    expect(editor.edited).toBe(true)
    tool.onCancel()
    expect(editor.currentTool).toBe('select')
  })
})
