import { describe, expect, it, vi } from 'vitest'
import { Box } from '../src/renderer/src/canvas/math/Box'
import { Mat } from '../src/renderer/src/canvas/math/Mat'
import { HALF_PI, PI, PI2 } from '../src/renderer/src/canvas/math/utils'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import type { IndexKey, TLPageId, TLShape, TLShapeId } from '../src/renderer/src/canvas/schema'
import { snapResizeBounds, snapTranslateBounds } from '../src/renderer/src/canvas/tools/snaps'
import {
  DraggingHandle,
  Resizing,
  Rotating,
  Translating,
  calculateResize,
  dragHandle,
  getRotationDelta,
  getTranslationDelta,
  resizeBox,
  resizeShape,
  rotateShapes,
  translateShape,
  type RotationSnapshot,
  type TransformEditor,
  type TransformHandle
} from '../src/renderer/src/canvas/tools/transforms'

type GeoShape = Extract<TLShape, { type: 'geo' }>

function geoShape(
  id: string,
  overrides: Omit<Partial<GeoShape>, 'props'> & { props?: Partial<GeoShape['props']> } = {}
): GeoShape {
  return {
    id: `shape:${id}` as TLShapeId,
    typeName: 'shape',
    type: 'geo',
    x: 0,
    y: 0,
    rotation: 0,
    index: 'a1' as IndexKey,
    parentId: 'page:page' as TLPageId,
    isLocked: false,
    opacity: 1,
    props: {
      geo: 'rectangle',
      dash: 'solid',
      url: '',
      w: 100,
      h: 50,
      growY: 0,
      scale: 1,
      labelColor: 'black',
      color: 'black',
      fill: 'none',
      size: 'm',
      font: 'sans',
      align: 'middle',
      verticalAlign: 'middle',
      richText: { type: 'doc', content: [] },
      ...overrides.props
    },
    meta: {},
    ...overrides
  } as GeoShape
}

function near(point: { x: number; y: number }, x: number, y: number): void {
  expect(point.x).toBeCloseTo(x, 8)
  expect(point.y).toBeCloseTo(y, 8)
}

describe('canvas transforms', () => {
  it('translates in page space, locks an axis, snaps the average, and returns to parent space', () => {
    near(getTranslationDelta(new Vec(), new Vec(3, 9), { shiftKey: true }), 0, 9)
    near(getTranslationDelta(new Vec(), new Vec(9, 3), { shiftKey: true }), 9, 0)
    near(
      getTranslationDelta(new Vec(), new Vec(7, 8), {
        gridSize: 10,
        averagePagePoint: new Vec(4, 4)
      }),
      6,
      6
    )

    const shape = geoShape('translated')
    const update = translateShape(
      {
        shape,
        pagePoint: new Vec(20, 30),
        parentTransform: Mat.Inverse(Mat.Translate(10, 20))
      },
      new Vec(5, 7)
    )
    near(update as { x: number; y: number }, 15, 17)
  })

  it('resizes box shapes with the expected minimum, flip, handle, and rotation behavior', () => {
    const shape = geoShape('box', { x: 10, y: 20 })
    const initialBounds = new Box(0, 0, 100, 50)
    const left = resizeBox(shape, {
      newPoint: new Vec(109.5, 20),
      handle: 'left',
      mode: 'resize_bounds',
      scaleX: 0.005,
      scaleY: 1,
      initialBounds,
      initialShape: shape
    })
    expect(left.props.w).toBe(1)
    expect(left.x).toBe(109)
    expect(left.y).toBe(20)

    const flipped = resizeBox(shape, {
      newPoint: new Vec(110, 70),
      handle: 'top_left',
      mode: 'resize_bounds',
      scaleX: -0.5,
      scaleY: -2,
      initialBounds,
      initialShape: shape
    })
    expect(flipped.props.w).toBe(50)
    expect(flipped.props.h).toBe(100)
    near(flipped, 60, -30)

    const rotated = resizeBox(geoShape('rotated-box', { x: 10, y: 20, rotation: HALF_PI }), {
      newPoint: new Vec(10, 20),
      handle: 'bottom_right',
      mode: 'resize_bounds',
      scaleX: -1,
      scaleY: 1,
      initialBounds,
      initialShape: shape
    })
    near(rotated, 10, -80)
  })

  it('calculates corner, edge, centered, aspect-locked, and rotated selection scales', () => {
    const bounds = new Box(0, 0, 100, 50)
    const corner = calculateResize({
      selectionBounds: bounds,
      selectionRotation: 0,
      handle: 'bottom_right',
      originPagePoint: new Vec(100, 50),
      currentPagePoint: new Vec(200, 100)
    })
    near(corner.scale, 2, 2)
    near(corner.scaleOrigin, 0, 0)

    const edge = calculateResize({
      selectionBounds: bounds,
      selectionRotation: 0,
      handle: 'right',
      originPagePoint: new Vec(100, 25),
      currentPagePoint: new Vec(200, 80)
    })
    near(edge.scale, 2, 1)

    const centered = calculateResize({
      selectionBounds: bounds,
      selectionRotation: 0,
      handle: 'bottom_right',
      originPagePoint: new Vec(100, 50),
      currentPagePoint: new Vec(150, 75),
      fromCenter: true
    })
    near(centered.scaleOrigin, 50, 25)
    near(centered.scale, 2, 2)

    const locked = calculateResize({
      selectionBounds: bounds,
      selectionRotation: 0,
      handle: 'bottom_right',
      originPagePoint: new Vec(100, 50),
      currentPagePoint: new Vec(200, 75),
      isAspectRatioLocked: true
    })
    near(locked.scale, 2, 2)

    const rotated = calculateResize({
      selectionBounds: bounds,
      selectionRotation: HALF_PI,
      handle: 'bottom_right',
      originPagePoint: new Vec(-50, 100),
      currentPagePoint: new Vec(-100, 200)
    })
    near(rotated.scale, 2, 2)
  })

  it('resizes a shape around a page-space origin and converts it back through its parent', () => {
    const shape = geoShape('nested', {
      x: 10,
      y: 20,
      parentId: 'shape:parent' as TLShapeId
    })
    const update = resizeShape(
      {
        shape,
        bounds: new Box(0, 0, 100, 50),
        pageTransform: Mat.Translate(110, 220),
        parentTransform: Mat.Inverse(Mat.Translate(100, 200))
      },
      new Vec(2, 2),
      {
        scaleOrigin: new Vec(100, 200),
        scaleAxisRotation: 0,
        handle: 'bottom_right',
        mode: 'resize_bounds'
      }
    ) as GeoShape
    near(update, 20, 40)
    expect(update.props.w).toBe(200)
    expect(update.props.h).toBe(100)
  })

  it('keeps an unaligned shape uniform and compensates its center and mirrored rotation', () => {
    const shape = geoShape('unaligned', { x: 100, rotation: PI / 4 })
    const pageTransform = Mat.Compose(Mat.Translate(100, 0), Mat.Rotate(PI / 4))
    const snapshot = {
      shape,
      bounds: new Box(0, 0, 100, 50),
      pageTransform,
      parentTransform: null
    }
    const update = resizeShape(snapshot, new Vec(2, 1), {
      scaleOrigin: new Vec(),
      scaleAxisRotation: 0,
      handle: 'bottom_right'
    }) as GeoShape
    expect(update.props.w).toBe(100)
    expect(update.props.h).toBe(50)
    near(update, 217.67766953, 0)

    const mirrored = resizeShape(snapshot, new Vec(-2, 1), {
      scaleOrigin: new Vec(),
      scaleAxisRotation: 0,
      handle: 'bottom_right'
    }) as GeoShape
    expect(mirrored.rotation).toBeCloseTo(-PI / 4, 8)
    near(mirrored, -288.38834765, 70.71067812)
  })

  it('rotates page points and local angles around a shared center', () => {
    const first = geoShape('first', { x: 10, rotation: PI2 - HALF_PI })
    const second = geoShape('second', { x: -10 })
    const snapshot: RotationSnapshot<GeoShape> = {
      initialPageCenter: new Vec(),
      initialCursorAngle: 0,
      initialShapesRotation: 0,
      shapeSnapshots: [
        { shape: first, initialPagePoint: new Vec(10, 0), parentTransform: null },
        { shape: second, initialPagePoint: new Vec(-10, 0), parentTransform: null }
      ]
    }
    const updates = rotateShapes(snapshot, HALF_PI)
    near(updates[0] as { x: number; y: number }, 0, 10)
    near(updates[1] as { x: number; y: number }, 0, -10)
    expect(updates[0].rotation).toBeCloseTo(0, 8)
    expect(updates[1].rotation).toBeCloseTo(HALF_PI, 8)

    expect(getRotationDelta({ snapshot, currentPagePoint: new Vec(0, 10) })).toBeCloseTo(HALF_PI, 8)
    expect(
      getRotationDelta({
        snapshot,
        currentPagePoint: Vec.FromAngle(PI / 11, 10),
        shiftKey: true
      })
    ).toBeCloseTo(PI / 12, 8)
    expect(
      getRotationDelta({
        snapshot,
        currentPagePoint: Vec.FromAngle((88 * PI) / 180, 10),
        snapToNearestDegree: true,
        isCoarsePointer: true
      })
    ).toBeCloseTo(HALF_PI, 8)
  })

  it('drags handles through shape rotation and snaps their angle from an adjacent vertex', () => {
    const handle: TransformHandle = { id: 'end', type: 'vertex', x: 10, y: 0 }
    near(
      dragHandle({
        initialHandle: handle,
        originPagePoint: new Vec(),
        currentPagePoint: new Vec(0, 10),
        pageRotation: HALF_PI
      }),
      20,
      0
    )

    const target = Vec.FromAngle((20 * PI) / 180, 10)
    const snapped = dragHandle({
      initialHandle: handle,
      initialAdjacentHandle: { id: 'start', type: 'vertex', x: 0, y: 0 },
      originPagePoint: new Vec(),
      currentPagePoint: Vec.Sub(target, handle),
      pageRotation: 0,
      shiftKey: true
    })
    const expected = Vec.FromAngle(PI / 12, 10)
    near(snapped, expected.x, expected.y)
  })

  it('exposes state-node-shaped classes that drive the standalone operations', () => {
    const shape = geoShape('state')
    let current = shape
    const transition = vi.fn()
    const editor = {
      inputs: {
        getCurrentPagePoint: () => new Vec(15, 25),
        getOriginPagePoint: () => new Vec(5, 5),
        getShiftKey: () => false
      },
      getShape: () => current,
      updateShapes: (updates: Array<Partial<GeoShape>>) => {
        current = { ...current, ...updates[0], props: { ...current.props, ...updates[0]?.props } }
      },
      setCursor: vi.fn(),
      markHistoryStoppingPoint: () => 'mark:1'
    } as unknown as TransformEditor<GeoShape>
    const state = new Translating(editor, { transition })
    state.enter({
      snapshots: [{ shape, pagePoint: new Vec(), parentTransform: null }]
    })
    expect(state.id).toBe('translating')
    expect(state.getIsActive()).toBe(true)
    near(current, 10, 20)
    state.onPointerUp()
    expect(transition).toHaveBeenCalledWith('idle', expect.anything())
    state.exit()
    expect(state.getIsActive()).toBe(false)

    expect(Resizing.id).toBe('resizing')
    expect(Rotating.id).toBe('rotating')
    expect(DraggingHandle.id).toBe('dragging_handle')
    expect(Translating.trackPerformance).toBe(true)
    expect(Resizing.trackPerformance).toBe(true)
    expect(Rotating.trackPerformance).toBe(true)
    expect(DraggingHandle.trackPerformance).toBe(true)
  })

  it('drives translation snapping through the state and owns its indicators', () => {
    const shape = geoShape('translate-snap')
    let current = shape
    let indicators: unknown[] = []
    const clearIndicators = vi.fn(() => {
      indicators = []
    })
    const editor = {
      inputs: {
        getCurrentPagePoint: () => new Vec(89, 0),
        getOriginPagePoint: () => new Vec(),
        getShiftKey: () => false,
        getAccelKey: () => false
      },
      getShape: () => current,
      updateShapes: (updates: Array<Partial<GeoShape>>) => {
        current = { ...current, ...updates[0], props: { ...current.props, ...updates[0]?.props } }
      },
      getIsSnapMode: () => true,
      snaps: {
        snapTranslateBounds,
        setIndicators: (next: unknown[]) => {
          indicators = next
        },
        clearIndicators
      }
    } as unknown as TransformEditor<GeoShape>
    const state = new Translating(editor)
    state.enter({
      snapshots: [{ shape, pagePoint: new Vec(), parentTransform: null }],
      initialPageBounds: new Box(0, 20, 10, 10),
      snappableShapes: [{ id: 'target', pageBounds: new Box(100, 0, 10, 50) }]
    })

    near(current, 90, 0)
    expect(indicators).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'point:x:100' })]))
    state.exit()
    expect(clearIndicators).toHaveBeenCalledOnce()
    expect(indicators).toEqual([])
  })

  it('snaps a single rotated shape by its own corners rather than its bounding box', () => {
    const shape = geoShape('rotated-snap', { rotation: PI / 4, props: { w: 100, h: 100 } })
    let current = shape
    let asked: { initialSelectionSnapPoints?: readonly { x: number; y: number }[] } | undefined
    const editor = {
      inputs: {
        getCurrentPagePoint: () => new Vec(),
        getOriginPagePoint: () => new Vec(),
        getShiftKey: () => false,
        getAccelKey: () => false
      },
      getShape: () => current,
      getSelectedShapeIds: () => [shape.id],
      getShapePageTransform: () => Mat.Rotate(PI / 4),
      getShapeGeometry: () => ({ bounds: new Box(0, 0, 100, 100) }),
      getSelectionPageBounds: () => new Box(-Math.SQRT1_2 * 100, 0, Math.SQRT2 * 100, Math.SQRT2 * 100),
      updateShapes: (updates: Array<Partial<GeoShape>>) => {
        current = { ...current, ...updates[0] }
      },
      getIsSnapMode: () => true,
      snaps: {
        snapTranslateBounds: (options: typeof asked) => {
          asked = options
          return { nudge: new Vec(), indicators: [] }
        },
        setIndicators: () => {},
        clearIndicators: () => {}
      }
    } as unknown as TransformEditor<GeoShape>
    const state = new Translating(editor)
    state.enter({
      snapshots: [{ shape, pagePoint: new Vec(), parentTransform: null }],
      initialPageBounds: new Box(-Math.SQRT1_2 * 100, 0, Math.SQRT2 * 100, Math.SQRT2 * 100),
      snappableShapes: []
    })

    const points = asked?.initialSelectionSnapPoints ?? []
    expect(points).toHaveLength(5)
    const has = (x: number, y: number) =>
      points.some(point => Math.abs(point.x - x) < 1e-6 && Math.abs(point.y - y) < 1e-6)
    expect(has(0, 0)).toBe(true)
    expect(has(Math.SQRT1_2 * 100, Math.SQRT1_2 * 100)).toBe(true)
    expect(has(-Math.SQRT1_2 * 100, 0)).toBe(false)
  })

  it('drives resize snapping through the state and clears indicators on cancel', () => {
    const shape = geoShape('resize-snap', { y: 20, props: { w: 20, h: 20 } })
    let current = shape
    let indicators: unknown[] = []
    const clearIndicators = vi.fn(() => {
      indicators = []
    })
    const editor = {
      inputs: {
        getCurrentPagePoint: () => new Vec(98, 30),
        getOriginPagePoint: () => new Vec(20, 30),
        getShiftKey: () => false,
        getAltKey: () => false,
        getAccelKey: () => false
      },
      getShape: () => current,
      updateShapes: (updates: Array<Partial<GeoShape>>) => {
        current = { ...current, ...updates[0], props: { ...current.props, ...updates[0]?.props } }
      },
      getIsSnapMode: () => true,
      snaps: {
        snapResizeBounds,
        setIndicators: (next: unknown[]) => {
          indicators = next
        },
        clearIndicators
      }
    } as unknown as TransformEditor<GeoShape>
    const state = new Resizing(editor)
    state.enter({
      handle: 'right',
      snapshots: [
        {
          shape,
          bounds: new Box(0, 0, 20, 20),
          pageTransform: Mat.Translate(0, 20),
          parentTransform: null
        }
      ],
      selectionBounds: new Box(0, 20, 20, 20),
      snappableShapes: [{ id: 'target', pageBounds: new Box(100, 0, 10, 60) }],
      zoom: 2
    })

    near(current, 0, 20)
    expect(current.props.w).toBe(100)
    expect(current.props.h).toBe(20)
    expect(indicators).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'point:x:100' })]))
    state.onCancel()
    expect(clearIndicators).toHaveBeenCalledOnce()
    expect(indicators).toEqual([])
  })
})
