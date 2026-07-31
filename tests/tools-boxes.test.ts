import { afterEach, describe, expect, it, vi } from 'vitest'
import { nodeDefaults } from '../src/shared/designNode'
import { Box, Vec, type VecLike } from '../src/renderer/src/canvas/math'
import { ZERO_INDEX_KEY } from '../src/renderer/src/canvas/schema/indices'
import { fromPlainText, type TLShape, type TLShapeId, type TLShapeType } from '../src/renderer/src/canvas/schema'
import {
  BaseBoxShapeTool,
  type BoxPointerInfo,
  type BoxShapeCreate,
  type BoxShapeUpdate,
  type BoxToolEditor
} from '../src/renderer/src/canvas/tools/box'
import { FrameShapeTool, getEnclosedShapeIds } from '../src/renderer/src/canvas/tools/frame'
import { NoteShapeTool } from '../src/renderer/src/canvas/tools/note'
import { TextShapeTool } from '../src/renderer/src/canvas/tools/text'

function defaultProps(type: TLShapeType): Record<string, unknown> {
  if (type === 'frame') return { w: 320, h: 180, name: '', color: 'black' }
  if (type === 'design-node') return nodeDefaults()
  if (type === 'text') {
    return {
      color: 'black',
      size: 'm',
      font: 'draw',
      textAlign: 'start',
      w: 8,
      richText: fromPlainText(''),
      scale: 1,
      autoSize: true
    }
  }
  if (type === 'note') {
    return {
      color: 'black',
      labelColor: 'black',
      size: 'm',
      font: 'draw',
      fontSizeAdjustment: 1,
      align: 'middle',
      verticalAlign: 'middle',
      growY: 0,
      url: '',
      richText: fromPlainText(''),
      scale: 1,
      textLastEditedBy: null
    }
  }
  throw new Error(`No defaults for ${type}`)
}

function makeShape(input: BoxShapeCreate): TLShape {
  return {
    id: input.id,
    typeName: 'shape',
    type: input.type,
    x: input.x,
    y: input.y,
    rotation: 0,
    index: ZERO_INDEX_KEY,
    parentId: 'page:test',
    isLocked: false,
    opacity: 1,
    props: { ...defaultProps(input.type), ...input.props },
    meta: {}
  } as unknown as TLShape
}

class BoxEditor implements BoxToolEditor {
  origin = new Vec()
  current = new Vec()
  dragging = false
  pointing = true
  grid = false
  locked = false
  coarse = false
  scale = 1
  zoom = 1
  cursor = ''
  currentTool = ''
  currentToolInfo: BoxPointerInfo | undefined
  selected: TLShapeId[] = []
  editing: TLShapeId | undefined
  shapes = new Map<TLShapeId, TLShape>()
  marks = new Map<string, Map<TLShapeId, TLShape>>()
  markCount = 0
  reparented: { ids: TLShapeId[]; parentId: TLShapeId } | undefined

  options = {
    adjacentShapeMargin: 20,
    coarseDragDistanceSquared: 36,
    dragDistanceSquared: 16
  }

  inputs = {
    getOriginPagePoint: () => this.origin,
    getCurrentPagePoint: () => this.current,
    getIsDragging: () => this.dragging,
    getIsPointing: () => this.pointing
  }

  createShapes(shapes: BoxShapeCreate[]): void {
    for (const shape of shapes) this.shapes.set(shape.id, makeShape(shape))
  }

  updateShape(update: BoxShapeUpdate): void {
    const shape = this.shapes.get(update.id)
    if (!shape) return
    this.shapes.set(update.id, {
      ...shape,
      x: update.x ?? shape.x,
      y: update.y ?? shape.y,
      props: { ...shape.props, ...update.props }
    } as TLShape)
  }

  updateShapes(updates: BoxShapeUpdate[]): void {
    for (const update of updates) this.updateShape(update)
  }

  getShape(id: TLShapeId): TLShape | undefined { return this.shapes.get(id) }

  getShapePageBounds(shape: TLShape): Box {
    if (shape.type === 'text') return new Box(shape.x, shape.y, shape.props.w * shape.props.scale, 24 * shape.props.scale)
    if (shape.type === 'note') return new Box(shape.x, shape.y, 200 * shape.props.scale, (200 + shape.props.growY) * shape.props.scale)
    const props = shape.props as { w: number; h: number }
    return new Box(shape.x, shape.y, props.w, props.h)
  }

  getShapeGeometry(shape: TLShape): { bounds: Box } {
    const bounds = this.getShapePageBounds(shape)
    return { bounds: new Box(0, 0, bounds.width, bounds.height) }
  }

  getShapeParentTransform(): null { return null }

  getShapePageTransform(id: TLShapeId) {
    const shape = this.shapes.get(id)
    if (!shape) return null
    return { rotation: () => shape.rotation, point: () => new Vec(shape.x, shape.y) }
  }

  getShapeAncestors(): TLShape[] { return [] }

  getSortedChildIdsForParent(parentId: TLShape['parentId']): TLShapeId[] {
    return [...this.shapes.values()].filter((shape) => shape.parentId === parentId).map((shape) => shape.id)
  }

  getCurrentPageShapes(): TLShape[] { return [...this.shapes.values()] }
  getSelectedShapeIds(): TLShapeId[] { return this.selected }

  isPointInShape(shape: TLShape, point: VecLike): boolean {
    return this.getShapePageBounds(shape).containsPoint(point)
  }

  canEditShape(shape: TLShape | undefined): boolean {
    return shape?.type === 'text' || shape?.type === 'note'
  }

  getOnlySelectedShape(): TLShape | undefined {
    return this.selected.length === 1 ? this.shapes.get(this.selected[0]) : undefined
  }

  markHistoryStoppingPoint(name: string): string {
    const id = `${name}:${this.markCount++}`
    this.marks.set(id, structuredClone(this.shapes))
    return id
  }

  bailToMark(id: string): void {
    const snapshot = this.marks.get(id)
    if (snapshot) this.shapes = structuredClone(snapshot)
  }

  select(id: TLShapeId): void { this.selected = [id] }
  setSelectedShapes(ids: TLShapeId[]): void { this.selected = ids }
  setEditingShape(shape: TLShape): void { this.editing = shape.id }
  setHintingShapes(): void {}
  updateHoveredShapeId(): void {}
  cancelUpdateHoveredShapeId(): void {}

  reparentShapes(ids: TLShapeId[], parentId: TLShapeId): void {
    this.reparented = { ids, parentId }
    for (const id of ids) {
      const shape = this.shapes.get(id)
      if (shape) this.shapes.set(id, { ...shape, parentId } as TLShape)
    }
  }

  setCurrentTool(id: string, info?: BoxPointerInfo): void {
    this.currentTool = id
    this.currentToolInfo = info
  }

  setCursor(cursor: { type: string }): void { this.cursor = cursor.type }
  getResizeScaleFactor(): number { return this.scale }
  getZoomLevel(): number { return this.zoom }
  getInstanceState() { return { isGridMode: this.grid, isToolLocked: this.locked, isCoarsePointer: this.coarse } }
  getDocumentSettings() { return { gridSize: 10 } }
}

class DesignNodeTool extends BaseBoxShapeTool {
  static override readonly id = 'design-node'
  readonly shapeType = 'design-node' as const
}

afterEach(() => {
  vi.useRealTimers()
})

describe('box creation', () => {
  it('centers a click-created design node, applies dynamic scale and snaps its top left', () => {
    const editor = new BoxEditor()
    editor.origin.set(103, 103)
    editor.scale = 2
    editor.grid = true
    const tool = new DesignNodeTool(editor)
    tool.onPointerDown()
    tool.onPointerUp()
    const shape = [...editor.shapes.values()][0]
    expect(tool.getCurrentStateId()).toBe('design-node.pointing')
    expect(shape).toMatchObject({ type: 'design-node', x: -100, y: -20, props: { w: 400, h: 240 } })
    expect(editor.selected).toEqual([shape.id])
    expect(editor.currentTool).toBe('select.idle')
  })

  it('starts selection resizing after a drag with the creation contract intact', () => {
    const editor = new BoxEditor()
    editor.origin.set(30, 40)
    editor.dragging = true
    const tool = new DesignNodeTool(editor)
    tool.onPointerDown({ pointerId: 2 })
    tool.onPointerMove({ pointerId: 2 })
    const shape = [...editor.shapes.values()][0]
    expect(shape).toMatchObject({ type: 'design-node', x: 30, y: 40, props: { w: 1, h: 1 } })
    expect(editor.currentTool).toBe('select.resizing')
    expect(editor.currentToolInfo).toMatchObject({
      pointerId: 2,
      target: 'selection',
      handle: 'bottom_right',
      isCreating: true,
      creationCursorOffset: { x: 1, y: 1 },
      onInteractionEnd: 'design-node'
    })
  })

  it('keeps a locked box tool active after click creation', () => {
    const editor = new BoxEditor()
    editor.locked = true
    const tool = new DesignNodeTool(editor)
    tool.onPointerDown()
    tool.onPointerUp()
    expect(tool.getCurrentStateId()).toBe('design-node.idle')
    expect(editor.currentTool).toBe('')
  })
})

describe('frame creation', () => {
  it('finds only unlocked sibling shapes enclosed by a frame', () => {
    const editor = new BoxEditor()
    const insideId = 'shape:inside' as TLShapeId
    const outsideId = 'shape:outside' as TLShapeId
    const lockedId = 'shape:locked' as TLShapeId
    const frameId = 'shape:frame' as TLShapeId
    editor.createShapes([
      { id: insideId, type: 'design-node', x: 20, y: 20 },
      { id: outsideId, type: 'design-node', x: 400, y: 400 },
      { id: lockedId, type: 'design-node', x: 40, y: 40 },
      { id: frameId, type: 'frame', x: 0, y: 0, props: { w: 350, h: 250 } }
    ])
    const locked = editor.getShape(lockedId)!
    editor.shapes.set(lockedId, { ...locked, isLocked: true } as TLShape)
    const frame = editor.getShape(frameId)!
    expect(getEnclosedShapeIds(editor, frame)).toEqual([insideId])
    const tool = new FrameShapeTool(editor)
    tool.onCreate(frame)
    expect(editor.reparented).toEqual({ ids: [insideId], parentId: frameId })
    expect(editor.currentTool).toBe('select.idle')
  })
})

describe('text creation', () => {
  it('creates centered auto-width text and starts editing it on release', () => {
    const editor = new BoxEditor()
    editor.origin.set(100, 80)
    const tool = new TextShapeTool(editor)
    tool.onPointerDown()
    tool.onPointerUp()
    const shape = [...editor.shapes.values()][0]
    expect(shape).toMatchObject({ type: 'text', x: 100, y: 68, props: { autoSize: true, w: 20 } })
    expect(editor.editing).toBe(shape.id)
    expect(editor.currentTool).toBe('select.editing_shape')
  })

  it('creates fixed-width text only after the horizontal drag threshold and delay', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    const editor = new BoxEditor()
    editor.origin.set(10, 20)
    editor.current.set(110, 20)
    const tool = new TextShapeTool(editor)
    tool.onPointerDown()
    tool.onPointerMove()
    expect(editor.shapes.size).toBe(0)
    vi.advanceTimersByTime(151)
    tool.onPointerMove({ pointerId: 3 })
    const shape = [...editor.shapes.values()][0]
    expect(shape).toMatchObject({ type: 'text', x: 10, y: 8, props: { autoSize: false, w: 100 } })
    expect(editor.currentTool).toBe('select.resizing')
    expect(editor.currentToolInfo).toMatchObject({
      pointerId: 3,
      handle: 'right',
      creationCursorOffset: { x: 100, y: 1 },
      onInteractionEnd: 'text'
    })
  })

  it('edits the selected text shape when Enter is pressed from idle', () => {
    const editor = new BoxEditor()
    const id = 'shape:text' as TLShapeId
    editor.createShapes([{ id, type: 'text', x: 0, y: 0 }])
    editor.select(id)
    const tool = new TextShapeTool(editor)
    tool.onKeyDown({ key: 'Enter' })
    expect(editor.editing).toBe(id)
    expect(editor.currentTool).toBe('select.editing_shape')
  })
})

describe('note creation', () => {
  it('creates a fine-pointer note on press and edits it on release', () => {
    const editor = new BoxEditor()
    editor.origin.set(100, 100)
    const tool = new NoteShapeTool(editor)
    tool.onPointerDown()
    const shape = [...editor.shapes.values()][0]
    expect(shape).toMatchObject({ type: 'note', x: 0, y: 0 })
    expect(editor.selected).toEqual([shape.id])
    tool.onPointerUp()
    expect(editor.editing).toBe(shape.id)
    expect(editor.currentTool).toBe('select.editing_shape')
  })

  it('defers coarse-pointer creation until release and cancels a long press cleanly', () => {
    const editor = new BoxEditor()
    editor.coarse = true
    editor.origin.set(100, 100)
    const tool = new NoteShapeTool(editor)
    tool.onPointerDown()
    expect(editor.shapes.size).toBe(0)
    tool.onLongPress()
    expect(editor.shapes.size).toBe(0)
    expect(tool.getCurrentStateId()).toBe('note.idle')
    tool.onPointerDown()
    tool.onPointerUp()
    expect(editor.shapes.size).toBe(1)
    expect(editor.currentTool).toBe('select.editing_shape')
  })

  it('returns to note idle without editing when the tool is locked', () => {
    const editor = new BoxEditor()
    editor.locked = true
    const tool = new NoteShapeTool(editor)
    tool.onPointerDown()
    tool.onPointerUp()
    expect(tool.getCurrentStateId()).toBe('note.idle')
    expect(editor.editing).toBeUndefined()
  })
})
