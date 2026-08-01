import { describe, expect, it, vi } from 'vitest'
import { Mat } from '../src/renderer/src/canvas/math'
import { StateNode } from '../src/renderer/src/canvas/tools/state'
import {
  EditingShape,
  Idle,
  PointingSelection,
  SELECT_BASE_STATES,
  SelectTool
} from '../src/renderer/src/canvas/tools/select'

class First extends StateNode<any> {
  static id = 'first'
  events: string[] = []

  onPointerDown(): void {
    this.events.push('pointer')
  }
}

class Second extends StateNode<any> {
  static id = 'second'
}

class Branch extends StateNode<any> {
  static id = 'branch'
  static initial = 'first'
  static children() {
    return [First, Second]
  }
}

class Root extends StateNode<any> {
  static id = 'root'
  static initial = 'branch'
  static children() {
    return [Branch]
  }
}

function editor() {
  const state = { isChangingStyle: false, duplicateProps: null as any }
  const inputs = {
    dragging: false,
    keys: new Set<string>(),
    getIsDragging: () => inputs.dragging,
    getIsPanning: () => false,
    getAltKey: () => false,
    getCtrlKey: () => false,
    getShiftKey: () => false,
    getCurrentPagePoint: () => ({ x: 20, y: 20 }),
    getOriginPagePoint: () => ({ x: 10, y: 10 }),
    getPreviousPagePoint: () => ({ x: 19, y: 19 })
  }
  return {
    inputs,
    options: { hitTestMargin: 8, selectLockedShapes: false },
    overlays: { getOverlayAtPoint: () => undefined },
    setCursor: vi.fn(),
    updateHoveredShapeId: vi.fn(),
    cancelUpdateHoveredShapeId: vi.fn(),
    getSelectedShapeIds: () => [],
    getSelectedShapes: () => [],
    getOnlySelectedShape: () => undefined,
    getHoveredShape: () => undefined,
    getZoomLevel: () => 1,
    getShapeAtPoint: () => undefined,
    getSelectedShapeAtPoint: () => undefined,
    getInstanceState: () => state,
    updateInstanceState: vi.fn((change: any) => Object.assign(state, change)),
    getCurrentPageState: () => ({ editingShapeId: null }),
    markHistoryStoppingPoint: vi.fn(),
    selectNone: vi.fn(),
    getIsReadonly: () => false,
    getSelectionRotation: () => 0,
    getFocusedGroupId: () => 'page:1',
    getCurrentPageId: () => 'page:1',
    getSelectionRotatedPageBounds: () => undefined,
    getShape: (shape: any) => shape,
    getShapeUtil: () => ({}),
    isShapeOrAncestorLocked: () => false,
    canCropShape: () => false,
    canEditShape: () => false,
    setEditingShape: vi.fn(),
    select: vi.fn(),
    setSelectedShapes: vi.fn(),
    getOutermostSelectableShape: (shape: any) => shape,
    findShapeAncestor: () => undefined,
    focus: vi.fn()
  }
}

function translatable() {
  const shape = { id: 'shape:a', type: 'geo', x: 0, y: 0, rotation: 0, parentId: 'page:1', index: 'a1' }
  return {
    ...editor(),
    updateShapes: vi.fn(),
    getSelectedShapeIds: () => [shape.id],
    getSelectedShapes: () => [shape],
    getOnlySelectedShape: () => shape,
    getShape: () => shape,
    getShapePageTransform: () => Mat.Identity(),
    getSelectionPageBounds: () => undefined,
    getShapeUtil: () => ({})
  }
}

describe('StateNode', () => {
  it('enters nested initial states and forwards events through the active path', () => {
    const root = new Root({})
    root.enter()
    expect(root.getPath()).toBe('root.branch.first')
    expect(root.getIsActive()).toBe(true)
    expect(root.getCurrent()?.getCurrent()?.getIsActive()).toBe(true)
    root.handleEvent({ name: 'pointer_down' })
    expect((root.getCurrent()?.getCurrent() as First | undefined)?.events).toEqual(['pointer'])
  })

  it('transitions across a nested path and reports missing children', () => {
    const root = new Root({})
    root.enter()
    root.transition('branch.second')
    expect(root.getPath()).toBe('root.branch.second')
    expect(() => root.transition('missing')).toThrow('root - no child state exists with the id missing.')
  })

  it('adds states to branches while rejecting leaf and duplicate children', () => {
    const root = new Root({})
    const branch = root.getCurrent() as Branch
    class Third extends StateNode<any> {
      static id = 'third'
    }
    expect(branch.addChild(Third)).toBe(branch)
    expect(branch.children?.third).toBeInstanceOf(Third)
    expect(() => branch.addChild(Third)).toThrow("a child with id 'third' already exists")
    expect(() => branch.children?.first.addChild(Third)).toThrow('cannot add child to a leaf node')
  })
})

describe('SelectTool', () => {
  it('owns the whole 5.2.5 hierarchy, transform and crop states included', () => {
    expect(SelectTool.id).toBe('select')
    expect(SelectTool.initial).toBe('idle')
    expect(SelectTool.isLockable).toBe(false)
    expect(new Set(SELECT_BASE_STATES.map(State => State.id))).toEqual(
      new Set([
        'idle',
        'pointing_canvas',
        'pointing_shape',
        'brushing',
        'scribble_brushing',
        'pointing_selection',
        'pointing_resize_handle',
        'editing_shape',
        'pointing_rotate_handle',
        'pointing_arrow_label',
        'pointing_handle',
        'crop',
        'translating',
        'resizing',
        'rotating',
        'dragging_handle'
      ])
    )
  })

  it('reaches translating, resizing, rotating and dragging handle without anything adding them', () => {
    const tool = new SelectTool(editor())
    for (const id of ['translating', 'resizing', 'rotating', 'dragging_handle', 'crop']) {
      expect(tool.children?.[id], `${id} is not a child of select`).toBeDefined()
    }
    expect(tool.children?.crop.children?.pointing_crop_handle).toBeDefined()
  })

  it('routes a blank canvas press through idle to pointing canvas', () => {
    const host = editor()
    const tool = new SelectTool(host)
    tool.enter()
    tool.handleEvent({ name: 'pointer_down', target: 'canvas' })
    expect(tool.getPath()).toBe('select.pointing_canvas')
  })

  it('reaches translating from a pointer state without anything registering it', () => {
    const host = translatable()
    const tool = new SelectTool(host)
    tool.enter()
    tool.transition(PointingSelection.id)
    host.inputs.dragging = true
    tool.handleEvent({ name: 'pointer_move', target: 'selection' })
    expect(tool.getPath()).toBe('select.translating')
  })

  it('moves the selection by the drag delta once translating', () => {
    const host = translatable()
    const tool = new SelectTool(host)
    tool.enter()
    tool.transition(PointingSelection.id)
    host.inputs.dragging = true
    tool.handleEvent({ name: 'pointer_move', target: 'selection' })
    expect(host.updateShapes).toHaveBeenCalled()
    const [update] = host.updateShapes.mock.calls.at(-1)[0]
    expect(update).toMatchObject({ id: 'shape:a', x: 10, y: 10 })
  })

  it('starts editing an editable shape from idle', () => {
    const host = editor()
    const parent = {
      transition: vi.fn(),
      setCurrentToolIdMask: vi.fn()
    }
    const idle = new Idle(host, parent as any)
    host.getShapeUtil = () => ({})
    host.canEditShape = () => true
    idle.onDoubleClick({ target: 'shape', shape: { id: 'shape:1' }, phase: 'down' })
    expect(host.setEditingShape).toHaveBeenCalledWith({ id: 'shape:1' })
    expect(parent.transition).toHaveBeenCalledWith(EditingShape.id, expect.anything())
  })
})
