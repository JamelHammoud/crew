import { describe, expect, it, vi } from 'vitest'
import { Rectangle2d } from '../src/renderer/src/canvas/geometry/Rectangle2d'
import { Mat } from '../src/renderer/src/canvas/math/Mat'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import { decodePoints } from '../src/renderer/src/canvas/schema/points'
import { DrawTool, type FreehandEditor, type FreehandShape } from '../src/renderer/src/canvas/tools/draw'
import { EraserTool, type EraserEditor, type EraserShape } from '../src/renderer/src/canvas/tools/eraser'
import { HandTool, type HandEditor } from '../src/renderer/src/canvas/tools/hand'
import { HighlightTool } from '../src/renderer/src/canvas/tools/highlight'

function handEditor() {
  const input = {
    current: new Vec(0, 0),
    origin: new Vec(0, 0),
    velocity: new Vec(0, 0),
    dragging: false
  }
  let camera = new Vec(10, 20, 1)
  const editor: HandEditor = {
    inputs: {
      getCurrentScreenPoint: () => input.current,
      getOriginScreenPoint: () => input.origin,
      getPointerVelocity: () => input.velocity,
      getIsDragging: () => input.dragging
    },
    menus: { clearOpenMenus: vi.fn() },
    getCamera: () => camera,
    getZoomLevel: () => camera.z,
    getInstanceState: () => ({ isCoarsePointer: true }),
    getCameraOptions: () => ({ zoomSteps: [0.5, 1, 2] }),
    getBaseZoom: () => 1,
    setCamera: vi.fn(next => {
      camera = Vec.From(next)
    }),
    setCursor: vi.fn(),
    setCurrentTool: vi.fn(),
    stopCameraAnimation: vi.fn(),
    slideCamera: vi.fn(),
    zoomIn: vi.fn()
  }
  return { editor, input, camera: () => camera }
}

function freehandEditor(maxPointsPerShape = 200) {
  const input = {
    origin: new Vec(10, 20, 0.5),
    current: new Vec(10, 20, 0.5),
    pen: false,
    shift: false,
    ctrl: false,
    dragging: false
  }
  const shapes = new Map<string, FreehandShape>()
  const selectedTools: Array<{ id: string; info?: Record<string, unknown> }> = []
  const marks: string[] = []
  const bailed: string[] = []
  const editor: FreehandEditor = {
    inputs: {
      getCurrentPagePoint: () => input.current,
      getOriginPagePoint: () => input.origin,
      getIsPen: () => input.pen,
      getShiftKey: () => input.shift,
      getCtrlKey: () => input.ctrl,
      getIsDragging: () => input.dragging
    },
    options: { dragDistanceSquared: 16 },
    snaps: { clearIndicators: vi.fn(), setIndicators: vi.fn() },
    user: { getIsDynamicResizeMode: () => false, getIsSnapMode: () => false },
    setCursor: vi.fn(),
    setCurrentTool: (id, info) => selectedTools.push({ id, info }),
    getZoomLevel: () => 1,
    getResizeScaleFactor: () => 1,
    getCurrentTheme: () => ({ strokeWidth: 2 }),
    getShapeUtil: () => ({ options: { maxPointsPerShape } }),
    getShape: id => shapes.get(id),
    getPointInShapeSpace: (shape, p) => new Vec(p.x - shape.x, p.y - shape.y, p.z ?? 0.5),
    getShapePageTransform: shape => {
      const value = typeof shape === 'string' ? shapes.get(shape) : shape
      return value ? Mat.Translate(value.x, value.y) : undefined
    },
    markHistoryStoppingPoint: label => {
      marks.push(label)
      return `mark:${marks.length}`
    },
    bailToMark: id => bailed.push(id),
    createShape: partial => {
      shapes.set(partial.id, {
        id: partial.id,
        type: partial.type,
        x: partial.x,
        y: partial.y,
        props: {
          size: 'm',
          scale: 1,
          isPen: false,
          isComplete: false,
          isClosed: false,
          segments: [],
          ...partial.props
        }
      } as FreehandShape)
    },
    updateShapes: updates => {
      for (const update of updates) {
        const shape = shapes.get(update.id)
        if (shape) shape.props = { ...shape.props, ...update.props }
      }
    },
    canCreateShapes: () => true
  }
  return { editor, input, shapes, selectedTools, marks, bailed }
}

function eraserEditor() {
  const input = {
    origin: new Vec(5, 5),
    previous: new Vec(5, 5),
    current: new Vec(5, 5),
    dragging: false,
    accel: false
  }
  const shapes: EraserShape[] = [
    { id: 'bottom', type: 'geo' },
    { id: 'top', type: 'geo' },
    { id: 'far', type: 'geo' }
  ]
  let erasing: string[] = []
  const deleted: string[][] = []
  const marks: string[] = []
  const bailed: string[] = []
  const tools: string[] = []
  const stopped: string[] = []
  const rectangles = new Map([
    ['bottom', new Rectangle2d({ x: 0, y: 0, width: 20, height: 20, isFilled: true })],
    ['top', new Rectangle2d({ x: 0, y: 0, width: 20, height: 20, isFilled: true })],
    ['far', new Rectangle2d({ x: 40, y: 0, width: 20, height: 20, isFilled: true })]
  ])
  const editor: EraserEditor = {
    inputs: {
      getOriginPagePoint: () => input.origin,
      getCurrentPagePoint: () => input.current,
      getPreviousPagePoint: () => input.previous,
      getIsDragging: () => input.dragging,
      getAccelKey: () => input.accel
    },
    options: { hitTestMargin: 1 },
    scribbles: {
      addScribble: () => ({ id: 'scribble' }),
      addPoint: vi.fn(),
      stop: id => stopped.push(id)
    },
    setCursor: vi.fn(),
    setCurrentTool: id => tools.push(id),
    setCurrentToolIdMask: vi.fn(),
    getZoomLevel: () => 1,
    getCurrentPageShapes: () => shapes,
    getCurrentPageRenderingShapesSorted: () => shapes,
    getShapesAtPoint: p => shapes.filter(shape => rectangles.get(shape.id)!.hitTestPoint(p)),
    getShapeIdsInsideBounds: bounds =>
      new Set(shapes.filter(shape => rectangles.get(shape.id)!.bounds.collides(bounds)).map(shape => shape.id)),
    getShapeMask: () => undefined,
    getShapeGeometry: shape => rectangles.get(shape.id),
    getShapePageTransform: () => Mat.Identity(),
    getPointInShapeSpace: (_shape, p) => p,
    getOutermostSelectableShape: shape => shape,
    getErasingShapeIds: () => erasing,
    isShapeOrAncestorLocked: () => false,
    isShapeOfType: (shape, type) => shape.type === type,
    isShapeFrameLike: shape => shape.type === 'frame',
    isPointInShape: (shape, p, options) => rectangles.get(shape.id)!.hitTestPoint(p, options.margin),
    setErasingShapes: ids => {
      erasing = ids
    },
    markHistoryStoppingPoint: label => {
      marks.push(label)
      return `mark:${marks.length}`
    },
    bailToMark: id => bailed.push(id),
    deleteShapes: ids => deleted.push([...ids])
  }
  return { editor, input, erasing: () => erasing, deleted, marks, bailed, tools, stopped }
}

describe('the hand tool', () => {
  it('moves from pointing through dragging and carries camera momentum', () => {
    const { editor, input, camera } = handEditor()
    const tool = new HandTool(editor)
    expect(editor.setCursor).toHaveBeenLastCalledWith({ type: 'grab', rotation: 0 })
    tool.onPointerDown()
    expect(tool.stateId).toBe('pointing')
    input.dragging = true
    input.current = new Vec(20, 10)
    tool.onPointerMove()
    expect(tool.stateId).toBe('dragging')
    expect(camera()).toMatchObject({ x: 30, y: 30, z: 1 })
    input.velocity = new Vec(3, -1)
    tool.onPointerUp()
    expect(editor.slideCamera).toHaveBeenCalledWith({ speed: 2, direction: { x: 3, y: -1, z: 0 } })
    expect(tool.stateId).toBe('idle')
  })

  it('uses coarse double taps for anchored zoom and clamps the camera range', () => {
    const { editor, input, camera } = handEditor()
    input.origin = new Vec(100, 50)
    input.current = new Vec(100, 50)
    const tool = new HandTool(editor)
    tool.onDoubleClick({ phase: 'settle-down' })
    expect(tool.stateId).toBe('one_finger_zooming')
    input.current = new Vec(100, 500)
    tool.onPointerMove()
    expect(camera().z).toBe(2)
    expect(editor.menus.clearOpenMenus).toHaveBeenCalled()
    tool.onPointerUp()
    tool.onDoubleClick({ phase: 'settle-up' })
    expect(editor.zoomIn).toHaveBeenCalledWith(
      input.current,
      expect.objectContaining({ animation: expect.any(Object) })
    )
  })

  it('returns to select when idle is cancelled', () => {
    const { editor } = handEditor()
    new HandTool(editor).onCancel()
    expect(editor.setCurrentTool).toHaveBeenCalledWith('select')
  })
})

describe('the draw and highlight tools', () => {
  it('creates a two-dimensional freehand stroke and completes it on release', () => {
    const { editor, input, shapes, marks } = freehandEditor()
    const tool = new DrawTool(editor)
    tool.onPointerDown({ point: input.origin })
    expect(tool.stateId).toBe('drawing')
    const shape = [...shapes.values()][0]
    expect(shape.type).toBe('draw')
    expect(shape.props.segments[0].dim).toBe(2)
    input.current = new Vec(30, 40, 0.5)
    tool.onPointerMove()
    expect(decodePoints(shape.props.segments[0].path, 2)).toHaveLength(2)
    tool.onPointerUp()
    expect(shape.props.isComplete).toBe(true)
    expect(tool.stateId).toBe('idle')
    expect(marks).toEqual(['draw start'])
  })

  it('draws pressure in three dimensions and merges sub-pixel pen movement', () => {
    const { editor, input, shapes } = freehandEditor()
    input.pen = true
    input.origin = new Vec(0, 0, 0.2)
    input.current = input.origin.clone()
    const tool = new DrawTool(editor)
    tool.onPointerDown({ point: input.origin })
    const shape = [...shapes.values()][0]
    expect(shape.props.segments[0].dim).toBeUndefined()
    input.current = new Vec(0.25, 0.25, 0.4)
    tool.onPointerMove()
    expect(decodePoints(shape.props.segments[0].path)).toHaveLength(1)
    expect(decodePoints(shape.props.segments[0].path)[0].z).toBeCloseTo(0.5, 2)
  })

  it('switches between straight and free segments after the drag threshold', () => {
    const { editor, input, shapes } = freehandEditor()
    const tool = new DrawTool(editor)
    tool.onPointerDown({ point: input.origin })
    input.current = new Vec(20, 20)
    tool.onKeyDown({ key: 'Shift' })
    input.current = new Vec(30, 30)
    tool.onPointerMove()
    const shape = [...shapes.values()][0]
    expect(shape.props.segments.at(-1)?.type).toBe('straight')
    tool.onKeyUp({ key: 'Shift' })
    input.current = new Vec(40, 40)
    tool.onPointerMove()
    expect(shape.props.segments.at(-1)?.type).toBe('free')
  })

  it('keeps shift-clicked line extensions on the prior shape', () => {
    const { editor, input, shapes } = freehandEditor()
    const tool = new DrawTool(editor)
    tool.onPointerDown({ point: input.origin })
    input.current = new Vec(30, 20)
    tool.onPointerMove()
    tool.onPointerUp()
    const shape = [...shapes.values()][0]
    input.shift = true
    input.origin = new Vec(50, 20)
    input.current = input.origin.clone()
    tool.onPointerDown({ point: input.origin, shiftKey: true })
    expect(shapes).toHaveLength(1)
    expect(shape.props.segments).toHaveLength(2)
  })

  it('uses the shared drawing states for highlights without closing the stroke', () => {
    const { editor, input, shapes } = freehandEditor()
    const tool = new HighlightTool(editor)
    tool.onPointerDown({ point: input.origin })
    const shape = [...shapes.values()][0]
    input.current = new Vec(100, 20)
    tool.onPointerMove()
    input.current = new Vec(10, 20)
    tool.onPointerMove()
    expect(shape.type).toBe('highlight')
    expect(tool.children.drawing.canClose()).toBe(false)
    expect(shape.props.isClosed).toBe(false)
  })

  it('borrows the eraser on accel and restores history on a quiet interrupt', () => {
    const first = freehandEditor()
    const idle = new DrawTool(first.editor)
    idle.onPointerDown({ point: first.input.origin, accelKey: true })
    expect(first.selectedTools[0]).toMatchObject({ id: 'eraser.pointing', info: { onInteractionEnd: 'draw' } })
    const second = freehandEditor()
    const drawing = new DrawTool(second.editor)
    drawing.onPointerDown({ point: second.input.origin })
    drawing.onInterrupt()
    expect(second.bailed).toEqual(['mark:1'])
    expect(drawing.stateId).toBe('idle')
  })
})

describe('the eraser tool', () => {
  it('previews every hit shape and deletes them on click release', () => {
    const { editor, erasing, deleted, marks } = eraserEditor()
    const tool = new EraserTool(editor)
    tool.onPointerDown({})
    expect(tool.stateId).toBe('pointing')
    expect(erasing()).toEqual(['top', 'bottom'])
    tool.onPointerUp({})
    expect(deleted).toEqual([['top', 'bottom']])
    expect(marks).toEqual(['erase end'])
    expect(tool.stateId).toBe('idle')
    expect(erasing()).toEqual([])
  })

  it('limits accel clicks to the top shape', () => {
    const { editor, erasing } = eraserEditor()
    const tool = new EraserTool(editor)
    tool.onPointerDown({ accelKey: true })
    expect(erasing()).toEqual(['top'])
  })

  it('scribbles across candidates and clears the preview after deleting', () => {
    const { editor, input, erasing, deleted, stopped } = eraserEditor()
    const tool = new EraserTool(editor)
    tool.onPointerDown({})
    input.dragging = true
    input.previous = new Vec(5, 5)
    input.current = new Vec(50, 5)
    tool.onPointerMove({})
    expect(tool.stateId).toBe('erasing')
    expect(erasing()).toContain('far')
    tool.onPointerUp({})
    expect(deleted.at(-1)).toContain('far')
    expect(stopped).toEqual(['scribble'])
    expect(erasing()).toEqual([])
  })

  it('bails a cancelled scribble and returns borrowed erasers to their tool', () => {
    const first = eraserEditor()
    const tool = new EraserTool(first.editor)
    tool.onPointerDown({})
    first.input.dragging = true
    tool.onPointerMove({})
    tool.onCancel()
    expect(first.bailed).toEqual(['mark:1'])
    const second = eraserEditor()
    second.input.accel = true
    const borrowed = new EraserTool(second.editor, { onInteractionEnd: 'draw', accelKey: true })
    borrowed.onKeyUp({ ctrlKey: false, metaKey: false })
    expect(second.tools).toEqual(['draw'])
    expect(second.editor.setCurrentToolIdMask).toHaveBeenCalledWith('draw')
  })
})
