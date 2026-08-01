import { describe, expect, it, vi } from 'vitest'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import { ZERO_INDEX_KEY } from '../src/renderer/src/canvas/schema/indices'
import { fromPlainText, type TLShape, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { ToolManager } from '../src/renderer/src/canvas/editor/tools'
import { ArrowShapeTool, type ArrowToolEditor, type TLArrowShape } from '../src/renderer/src/canvas/tools/arrow'
import { type BoxShapeCreate, type BoxToolEditor } from '../src/renderer/src/canvas/tools/box'
import { DrawTool, type FreehandEditor, type FreehandShape } from '../src/renderer/src/canvas/tools/draw'
import { EraserTool, type EraserEditor } from '../src/renderer/src/canvas/tools/eraser'
import { FrameShapeTool } from '../src/renderer/src/canvas/tools/frame'
import { HandTool, type HandEditor } from '../src/renderer/src/canvas/tools/hand'
import { LineShapeTool, type LineToolEditor, type TLLineShape } from '../src/renderer/src/canvas/tools/line'
import { NoteShapeTool } from '../src/renderer/src/canvas/tools/note'
import { TextShapeTool } from '../src/renderer/src/canvas/tools/text'

function handEditor() {
  const input = { current: new Vec(), origin: new Vec(), velocity: new Vec(), dragging: false }
  let camera = new Vec(0, 0, 1)
  const editor: HandEditor = {
    inputs: {
      getCurrentScreenPoint: () => input.current,
      getOriginScreenPoint: () => input.origin,
      getPointerVelocity: () => input.velocity,
      getIsDragging: () => input.dragging
    },
    menus: { clearOpenMenus: vi.fn() },
    getCamera: () => camera,
    getZoomLevel: () => camera.z ?? 1,
    getInstanceState: () => ({ isCoarsePointer: false }),
    getCameraOptions: () => ({ zoomSteps: [0.5, 1, 2] }),
    getBaseZoom: () => 1,
    setCamera: next => {
      camera = Vec.From(next)
    },
    setCursor: vi.fn(),
    setCurrentTool: vi.fn(),
    stopCameraAnimation: vi.fn(),
    slideCamera: vi.fn(),
    zoomIn: vi.fn()
  }
  return { editor, input }
}

function freehandEditor() {
  const input = { origin: new Vec(0, 0, 0.5), current: new Vec(0, 0, 0.5), shift: false }
  const shapes = new Map<string, FreehandShape>()
  const editor: FreehandEditor = {
    inputs: {
      getCurrentPagePoint: () => input.current,
      getOriginPagePoint: () => input.origin,
      getIsPen: () => false,
      getShiftKey: () => input.shift,
      getCtrlKey: () => false,
      getIsDragging: () => false
    },
    options: { dragDistanceSquared: 16 },
    snaps: { clearIndicators: vi.fn(), setIndicators: vi.fn() },
    user: { getIsDynamicResizeMode: () => false, getIsSnapMode: () => false },
    setCursor: vi.fn(),
    setCurrentTool: vi.fn(),
    getZoomLevel: () => 1,
    getResizeScaleFactor: () => 1,
    getCurrentTheme: () => ({ strokeWidth: 2 }),
    getShapeUtil: () => ({ options: { maxPointsPerShape: 200 } }),
    getShape: id => shapes.get(id),
    getPointInShapeSpace: (shape, point) => new Vec(point.x - shape.x, point.y - shape.y, point.z),
    getShapePageTransform: () => undefined,
    markHistoryStoppingPoint: () => 'mark',
    bailToMark: vi.fn(),
    createShape: shape => {
      shapes.set(shape.id, { ...shape, props: { size: 'm', ...shape.props } } as unknown as FreehandShape)
    },
    updateShapes: updates => {
      for (const update of updates) {
        const shape = shapes.get(update.id)
        if (shape) shape.props = { ...shape.props, ...update.props }
      }
    },
    canCreateShapes: () => true
  }
  return { editor, input, shapes }
}

function eraserEditor() {
  const tools: string[] = []
  const editor = {
    inputs: {
      getOriginPagePoint: () => new Vec(),
      getCurrentPagePoint: () => new Vec(),
      getPreviousPagePoint: () => new Vec(),
      getIsDragging: () => false,
      getAccelKey: () => false
    },
    options: { hitTestMargin: 8 },
    scribbles: { addScribble: () => ({ id: 'scribble' }), addPoint: vi.fn(), stop: vi.fn() },
    setCursor: vi.fn(),
    setCurrentTool: (id: string) => tools.push(id),
    setCurrentToolIdMask: vi.fn(),
    getZoomLevel: () => 1,
    getCurrentPageShapes: () => [],
    getCurrentPageRenderingShapesSorted: () => [],
    getShapesAtPoint: () => [],
    getShapeIdsInsideBounds: () => new Set<string>(),
    getShapeMask: () => undefined,
    getShapeGeometry: () => undefined,
    getShapePageTransform: () => undefined,
    getPointInShapeSpace: (_shape: unknown, point: Vec) => point,
    getOutermostSelectableShape: (shape: { id: string; type: string }) => shape,
    getErasingShapeIds: () => [],
    getCurrentPageState: () => ({ erasingShapeIds: [] }),
    isShapeOrAncestorLocked: () => false,
    isShapeOfType: () => false,
    isShapeFrameLike: () => false,
    isPointInShape: () => false,
    setErasingShapes: vi.fn(),
    markHistoryStoppingPoint: () => 'mark',
    bailToMark: vi.fn(),
    deleteShapes: vi.fn()
  } as unknown as EraserEditor
  return { editor, tools }
}

function makeShape(input: BoxShapeCreate, props: Record<string, unknown>): TLShape {
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
    props: { ...props, ...input.props },
    meta: {}
  } as unknown as TLShape
}

const NOTE_PROPS = { scale: 1, growY: 0, richText: fromPlainText('') }

function boxEditor() {
  const shapes = new Map<TLShapeId, TLShape>()
  const editor = {
    inputs: {
      getOriginPagePoint: () => new Vec(),
      getCurrentPagePoint: () => new Vec(),
      getIsDragging: () => false,
      getIsPointing: () => true
    },
    options: { adjacentShapeMargin: 20, dragDistanceSquared: 16, coarseDragDistanceSquared: 36 },
    createShapes: (created: BoxShapeCreate[]) => {
      for (const shape of created) shapes.set(shape.id, makeShape(shape, NOTE_PROPS))
    },
    updateShape: vi.fn(),
    getShape: (id: TLShapeId) => shapes.get(id),
    getShapePageBounds: () => undefined,
    getShapeParentTransform: () => null,
    getShapeGeometry: () => ({ bounds: { width: 200, height: 200 } }),
    getCurrentPageShapes: () => [...shapes.values()],
    getSelectedShapeIds: () => [],
    markHistoryStoppingPoint: () => 'mark',
    bailToMark: vi.fn(),
    select: vi.fn(),
    setSelectedShapes: vi.fn(),
    setCurrentTool: vi.fn(),
    setCursor: vi.fn(),
    getResizeScaleFactor: () => 1,
    getZoomLevel: () => 1,
    getInstanceState: () => ({ isGridMode: false, isToolLocked: false, isCoarsePointer: false }),
    getDocumentSettings: () => ({ gridSize: 10 })
  } as unknown as BoxToolEditor
  return { editor, shapes }
}

function lineEditor() {
  const shapes = new Map<TLShapeId, TLLineShape>()
  const editor = {
    inputs: {
      getCurrentPagePoint: () => new Vec(),
      getIsDragging: () => false,
      getShiftKey: () => true
    },
    snaps: { clearIndicators: vi.fn() },
    getShape: (id: TLShapeId) => shapes.get(id),
    getShapeHandles: () => [],
    getShapeParentTransform: () => null,
    getZoomLevel: () => 1,
    getResizeScaleFactor: () => 1,
    getInstanceState: () => ({ isGridMode: false, isCoarsePointer: false }),
    getDocumentSettings: () => ({ gridSize: 10 }),
    markHistoryStoppingPoint: () => 'mark',
    createShapes: (created: Array<{ id: TLShapeId; x: number; y: number }>) => {
      for (const shape of created) {
        shapes.set(shape.id, {
          id: shape.id,
          type: 'line',
          x: shape.x,
          y: shape.y,
          props: { points: {} }
        } as unknown as TLLineShape)
      }
    },
    updateShapes: vi.fn(),
    select: vi.fn(),
    bailToMark: vi.fn(),
    setCurrentTool: vi.fn(),
    setCursor: vi.fn()
  } as unknown as LineToolEditor
  return { editor, shapes }
}

function arrowEditor() {
  const shapes = new Map<TLShapeId, TLArrowShape>()
  const editor = {
    inputs: {
      getCurrentPagePoint: () => new Vec(),
      getOriginPagePoint: () => new Vec(),
      getIsDragging: () => false
    },
    timers: { setTimeout: () => 0 as unknown as ReturnType<typeof setTimeout>, clearTimeout: vi.fn() },
    getShape: (id: TLShapeId) => shapes.get(id),
    getShapeHandles: () => [
      { id: 'start', type: 'vertex', index: ZERO_INDEX_KEY, x: 0, y: 0 },
      { id: 'end', type: 'vertex', index: ZERO_INDEX_KEY, x: 1, y: 1 }
    ],
    getShapeUtil: () => ({ options: { hoverPreciseTimeout: 100, pointingPreciseTimeout: 100 } }),
    getPointInShapeSpace: (_shape: TLArrowShape, point: Vec) => point,
    getResizeScaleFactor: () => 1,
    getInstanceState: () => ({ isGridMode: false, isCoarsePointer: false }),
    getDocumentSettings: () => ({ gridSize: 10 }),
    getOnlySelectedShape: () => undefined,
    canEditShape: () => false,
    updateArrowTargetState: () => null,
    clearArrowTargetState: vi.fn(),
    markHistoryStoppingPoint: () => 'mark',
    createShape: vi.fn(),
    updateShapes: vi.fn(),
    select: vi.fn(),
    bailToMark: vi.fn(),
    setCurrentTool: vi.fn(),
    setCursor: vi.fn()
  } as unknown as ArrowToolEditor
  return { editor }
}

describe('picking a tool up again', () => {
  it('puts the hand tool back on idle and asks for its own cursor', () => {
    const { editor, input } = handEditor()
    const tool = new HandTool(editor)
    tool.onPointerDown()
    input.dragging = true
    tool.onPointerMove()
    expect(tool.stateId).toBe('dragging')
    ;(editor.setCursor as ReturnType<typeof vi.fn>).mockClear()
    tool.enter()
    expect(tool.stateId).toBe('idle')
    expect(editor.setCursor).toHaveBeenCalledWith({ type: 'grab', rotation: 0 })
  })

  it('puts the draw tool back on idle and asks for its own cursor', () => {
    const { editor, input } = freehandEditor()
    const tool = new DrawTool(editor)
    tool.onPointerDown({ point: input.origin })
    expect(tool.stateId).toBe('drawing')
    ;(editor.setCursor as ReturnType<typeof vi.fn>).mockClear()
    tool.enter()
    expect(tool.stateId).toBe('idle')
    expect(editor.setCursor).toHaveBeenCalledWith({ type: 'cross', rotation: 0 })
  })

  it('puts the eraser back on idle and takes the mask of whichever tool borrowed it', () => {
    const { editor } = eraserEditor()
    const tool = new EraserTool(editor)
    tool.enter({ onInteractionEnd: 'draw', accelKey: true })
    expect(tool.stateId).toBe('idle')
    expect(editor.setCurrentToolIdMask).toHaveBeenCalledWith('draw')
    tool.onPointerDown({})
    expect(tool.stateId).toBe('pointing')
    tool.exit()
    expect(tool.info).toEqual({})
    expect(editor.setCurrentToolIdMask).toHaveBeenLastCalledWith(undefined)
  })

  it('puts a box tool back on idle after it was left pointing', () => {
    const { editor } = boxEditor()
    const tool = new FrameShapeTool(editor)
    tool.onPointerDown({})
    expect(tool.current.id).toBe('pointing')
    tool.enter()
    expect(tool.current.id).toBe('idle')
    expect(editor.setCursor).toHaveBeenCalledWith({ type: 'cross', rotation: 0 })
  })

  it('puts the text tool back on idle after it was left pointing', () => {
    const { editor } = boxEditor()
    const tool = new TextShapeTool(editor)
    tool.onPointerDown({})
    expect(tool.current.id).toBe('pointing')
    tool.enter()
    expect(tool.current.id).toBe('idle')
  })

  it('puts the note tool back on idle after it was left pointing', () => {
    const { editor } = boxEditor()
    const tool = new NoteShapeTool(editor)
    tool.onPointerDown({})
    expect(tool.current.id).toBe('pointing')
    tool.enter()
    expect(tool.current.id).toBe('idle')
  })

  it('puts the arrow tool back on idle after it was left pointing', () => {
    const { editor } = arrowEditor()
    const tool = new ArrowShapeTool(editor)
    tool.onPointerDown({})
    expect(tool.current.id).toBe('pointing')
    tool.enter()
    expect(tool.current.id).toBe('idle')
  })

  it('makes the line tool forget the line a shift click would have carried on', () => {
    const { editor, shapes } = lineEditor()
    const tool = new LineShapeTool(editor)
    tool.onPointerDown({})
    tool.onPointerUp({})
    expect(tool.current.id).toBe('idle')
    expect(shapes.size).toBe(1)
    tool.enter()
    tool.onPointerDown({})
    expect(shapes.size).toBe(2)
  })
})

describe('leaving a tool', () => {
  it('lets the draw tool go of the shape a shift press would have extended', () => {
    const { editor, input } = freehandEditor()
    const tool = new DrawTool(editor)
    tool.onPointerDown({ point: input.origin })
    expect(tool.children.drawing.initialShape).toBeDefined()
    tool.exit()
    expect(tool.children.drawing.initialShape).toBeUndefined()
  })
})

class StubTool {
  static readonly id = 'stub'
  readonly id = StubTool.id
  enter(): void {}
  exit(): void {}
}

describe('the editor switching between tools', () => {
  it('hands a tool back its initial state when it comes round again', () => {
    const { editor, input } = handEditor()
    const manager = new ToolManager(editor, [HandTool, StubTool], 'hand')
    const hand = manager.getCurrent() as unknown as HandTool
    hand.onPointerDown()
    input.dragging = true
    hand.onPointerMove()
    expect(hand.stateId).toBe('dragging')
    manager.setCurrentTool('stub')
    expect(manager.getCurrentToolId()).toBe('stub')
    ;(editor.setCursor as ReturnType<typeof vi.fn>).mockClear()
    manager.setCurrentTool('hand')
    expect(hand.stateId).toBe('idle')
    expect(editor.setCursor).toHaveBeenCalledWith({ type: 'grab', rotation: 0 })
  })
})
