import { describe, expect, it, vi } from 'vitest'
import { Box } from '../src/renderer/src/canvas/math/Box'
import { Mat } from '../src/renderer/src/canvas/math/Mat'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import {
  Resizing,
  Rotating,
  areAnglesCompatible,
  findAdjacentHandle,
  resizeShape,
  rotateSelectionHandle
} from '../src/renderer/src/canvas/tools/transforms'
import { shapesInReadingOrder } from '../src/renderer/src/canvas/tools/select/adjacent'
import { selectionHasBoundsBg } from '../src/renderer/src/canvas/tools/shapeTree'

function box(x: number, y: number, w: number, h: number) {
  return { id: 'shape:a', type: 'geo', x, y, rotation: 0, parentId: 'page:1', props: { w, h } }
}

function host(shape: any, overrides: Record<string, any> = {}) {
  const inputs = {
    shift: false,
    alt: false,
    origin: new Vec(100, 100),
    current: new Vec(100, 100),
    getShiftKey: () => inputs.shift,
    getAltKey: () => inputs.alt,
    getCtrlKey: () => false,
    getAccelKey: () => false,
    getIsDragging: () => true,
    getPointerVelocity: () => new Vec(),
    getOriginPagePoint: () => inputs.origin,
    getCurrentPagePoint: () => inputs.current
  }
  const shapes = new Map<string, any>([[shape.id, shape]])
  const editor: any = {
    inputs,
    updateShapes: vi.fn((updates: any[]) => {
      for (const update of updates) shapes.set(update.id, { ...shapes.get(update.id), ...update })
    }),
    getShape: (id: any) => shapes.get(typeof id === 'string' ? id : id.id),
    getSelectedShapeIds: () => [shape.id],
    getShapePageTransform: () => Mat.Identity(),
    getShapeParentTransform: () => undefined,
    getShapeGeometry: (s: any) => ({ bounds: new Box(0, 0, s.props.w, s.props.h) }),
    getShapeUtil: () => ({}),
    getSelectionRotation: () => 0,
    getSelectionRotatedPageBounds: () => new Box(shape.x, shape.y, shape.props.w, shape.props.h),
    getSelectionPageBounds: () => new Box(shape.x, shape.y, shape.props.w, shape.props.h),
    getInstanceState: () => ({ isGridMode: false, isToolLocked: false, cursor: { type: 'default', rotation: 0 } }),
    getDocumentSettings: () => ({ gridSize: 10 }),
    getIsSnapMode: () => false,
    getZoomLevel: () => 1,
    isShapeOfType: (s: any, type: string) => s.type === type,
    setCursor: vi.fn(),
    markHistoryStoppingPoint: () => 'mark',
    ...overrides
  }
  return { editor, inputs, shapes }
}

describe('resizing', () => {
  it('keeps the aspect ratio while shift is held', () => {
    const shape = box(0, 0, 100, 20)
    const { editor, inputs, shapes } = host(shape)
    const state = new Resizing(editor, { transition: () => undefined } as any)
    inputs.origin = new Vec(100, 20)
    inputs.current = new Vec(100, 20)
    state.enter({ target: 'selection', handle: 'bottom_right' })
    inputs.shift = true
    inputs.current = new Vec(400, 25)
    state.onPointerMove()
    const resized = shapes.get(shape.id)
    expect(resized.props.w / resized.props.h).toBeCloseTo(100 / 20, 6)
  })

  it('measures the drag from the handle rather than from where the pointer landed', () => {
    const shape = box(0, 0, 10, 10)
    const { editor, inputs, shapes } = host(shape)
    const state = new Resizing(editor, { transition: () => undefined } as any)
    inputs.origin = new Vec(14, 14)
    inputs.current = new Vec(14, 14)
    state.enter({ target: 'selection', handle: 'bottom_right' })
    inputs.current = new Vec(34, 34)
    state.onPointerMove()
    expect(shapes.get(shape.id).props.w).toBeCloseTo(30, 6)
  })

  it('turns the corner cursor over when the resize flips through zero', () => {
    const shape = box(0, 0, 100, 100)
    const { editor, inputs } = host(shape)
    const state = new Resizing(editor, { transition: () => undefined } as any)
    inputs.origin = new Vec(100, 100)
    inputs.current = new Vec(100, 100)
    state.enter({ target: 'selection', handle: 'bottom_right' })
    inputs.current = new Vec(-50, 100)
    state.onPointerMove()
    expect(editor.setCursor).toHaveBeenCalledWith(expect.objectContaining({ type: 'nesw-resize' }))
  })
})

describe('rotating', () => {
  it('snaps to fifteen degrees while shift is held', () => {
    const shape = box(0, 0, 100, 100)
    const { editor, inputs, shapes } = host(shape)
    const state = new Rotating(editor, { transition: () => undefined } as any)
    inputs.origin = new Vec(150, 50)
    inputs.current = new Vec(150, 50)
    state.enter({ target: 'selection', handle: 'top_left_rotate' })
    inputs.shift = true
    inputs.current = new Vec(140, 8)
    state.onPointerMove()
    const rotation = shapes.get(shape.id).rotation
    expect((rotation / (Math.PI / 12)) % 1).toBeCloseTo(0, 6)
  })

  it('wears the rotate cursor for the corner it was grabbed by', () => {
    const shape = box(0, 0, 100, 100)
    const { editor, inputs } = host(shape)
    const state = new Rotating(editor, { transition: () => undefined } as any)
    inputs.origin = new Vec(150, 50)
    inputs.current = new Vec(120, 20)
    state.enter({ target: 'selection', handle: 'top_left_rotate' })
    expect(editor.setCursor).toHaveBeenCalledWith(expect.objectContaining({ type: 'nwse-rotate' }))
  })
})

describe('handle dragging', () => {
  it('finds the adjacent vertex handle to snap an angle against', () => {
    const handles = [
      { id: 'start', type: 'vertex', index: 'a1', x: 0, y: 0 },
      { id: 'middle', type: 'virtual', index: 'a2', x: 5, y: 5 },
      { id: 'end', type: 'vertex', index: 'a3', x: 10, y: 10 }
    ]
    expect(findAdjacentHandle(handles, handles[0])?.id).toBe('end')
    expect(findAdjacentHandle(handles, handles[2])?.id).toBe('start')
  })

  it('prefers a handle's own named reference over the next one along', () => {
    const handles = [
      { id: 'start', type: 'vertex', index: 'a1', x: 0, y: 0, snapReferenceHandleId: 'end' },
      { id: 'mid', type: 'vertex', index: 'a2', x: 5, y: 5 },
      { id: 'end', type: 'vertex', index: 'a3', x: 10, y: 10 }
    ]
    expect(findAdjacentHandle(handles, handles[0])?.id).toBe('end')
  })
})

describe('handle rotation', () => {
  it('walks a handle round the selection by the selection rotation', () => {
    expect(rotateSelectionHandle('top', Math.PI / 2)).toBe('right')
    expect(rotateSelectionHandle('top_left', Math.PI)).toBe('bottom_right')
    expect(rotateSelectionHandle('right', 0)).toBe('right')
  })

  it('reads two angles a quarter turn apart as compatible', () => {
    expect(areAnglesCompatible(0, Math.PI / 2)).toBe(true)
    expect(areAnglesCompatible(0, Math.PI / 4)).toBe(false)
  })
})

describe('resizeShape', () => {
  it('takes the aspect ratio lock from the caller as well as from the shape', () => {
    const shape = box(0, 0, 100, 20)
    const snapshot = {
      shape,
      bounds: new Box(0, 0, 100, 20),
      pageTransform: Mat.Identity(),
      parentTransform: null,
      isAspectRatioLocked: false
    }
    const update: any = resizeShape(snapshot as any, new Vec(2, 5), {
      scaleOrigin: new Vec(0, 0),
      scaleAxisRotation: 0,
      handle: 'bottom_right',
      isAspectRatioLocked: true
    })
    expect(update.props.w / update.props.h).toBeCloseTo(100 / 20, 6)
  })
})

describe('reading order', () => {
  it('reads a grid left to right then top to bottom', () => {
    const shapes = [
      { id: 'shape:br' },
      { id: 'shape:tl' },
      { id: 'shape:tr' },
      { id: 'shape:bl' }
    ]
    const bounds: Record<string, Box> = {
      'shape:tl': new Box(0, 0, 10, 10),
      'shape:tr': new Box(200, 0, 10, 10),
      'shape:bl': new Box(0, 400, 10, 10),
      'shape:br': new Box(200, 400, 10, 10)
    }
    const editor: any = {
      getShapeUtil: () => ({ canTabTo: () => true }),
      getShapePageBounds: (shape: any) => bounds[shape.id]
    }
    expect(shapesInReadingOrder(editor, shapes).map((s: any) => s.id)).toEqual([
      'shape:tl',
      'shape:tr',
      'shape:bl',
      'shape:br'
    ])
  })
})

describe('selection background', () => {
  it('leaves a lone shape that hides its background out of the selection body', () => {
    const arrow = { id: 'shape:arrow', type: 'arrow' }
    const editor: any = {
      getSelectedShapeIds: () => [arrow.id],
      getOnlySelectedShape: () => arrow,
      getShapeUtil: () => ({ hideSelectionBoundsBg: () => true })
    }
    expect(selectionHasBoundsBg(editor)).toBe(false)
  })

  it('keeps the body for a shape that draws one', () => {
    const geo = { id: 'shape:geo', type: 'geo' }
    const editor: any = {
      getSelectedShapeIds: () => [geo.id],
      getOnlySelectedShape: () => geo,
      getShapeUtil: () => ({ hideSelectionBoundsBg: () => false })
    }
    expect(selectionHasBoundsBg(editor)).toBe(true)
  })
})
