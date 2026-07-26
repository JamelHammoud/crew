import type { Editor, TLShape, TLShapeId } from 'tldraw'

export interface FakeShape {
  id: string
  type: string
  parentId: string
  isLocked?: boolean
  meta?: Record<string, unknown>
  props?: Record<string, unknown>
}

export interface FakeBoard {
  editor: Editor
  calls: string[]
  shapes: Map<string, TLShape>
  order: string[]
  select: (...ids: string[]) => void
  shape: (id: string) => TLShape
}

const PAGE = 'page:main'

export function fakeBoard(list: FakeShape[]): FakeBoard {
  const calls: string[] = []
  const shapes = new Map<string, TLShape>()
  const order = list.map(shape => shape.id)
  let selected: string[] = []

  for (const shape of list) {
    shapes.set(shape.id, {
      id: shape.id,
      type: shape.type,
      parentId: shape.parentId,
      isLocked: shape.isLocked ?? false,
      meta: shape.meta ?? {},
      props: shape.props ?? {},
      x: 0,
      y: 0,
      rotation: 0
    } as unknown as TLShape)
  }

  const ids = (input: unknown): string[] =>
    (Array.isArray(input) ? input : []).map(item =>
      typeof item === 'string' ? item : ((item as TLShape).id as string)
    )

  const note =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${ids(args[0]).join(',')})`)
      return editor
    }

  const editor = {
    run: (fn: () => void) => fn(),
    markHistoryStoppingPoint: (name?: string) => calls.push(`mark(${name ?? ''})`),
    getSelectedShapes: () => selected.map(id => shapes.get(id)!),
    getSelectedShapeIds: () => [...selected],
    setSelectedShapes: (next: unknown) => {
      selected = ids(next)
      calls.push(`select(${selected.join(',')})`)
    },
    selectAll: () => {
      selected = [...order]
      calls.push('selectAll()')
    },
    selectNone: () => {
      selected = []
      calls.push('selectNone()')
    },
    getShape: (id: string) => shapes.get(id),
    getCurrentPageShapes: () => order.map(id => shapes.get(id)!),
    getSortedChildIdsForParent: (parent: unknown) => {
      const id = typeof parent === 'string' ? parent : ((parent as { id: string })?.id ?? PAGE)
      return order.filter(child => shapes.get(child)!.parentId === id)
    },
    updateShape: (edit: { id: string; props?: Record<string, unknown>; meta?: Record<string, unknown> }) => {
      const shape = shapes.get(edit.id)
      if (!shape) return editor
      shapes.set(edit.id, {
        ...shape,
        props: { ...shape.props, ...(edit.props ?? {}) },
        meta: { ...shape.meta, ...(edit.meta ?? {}) }
      } as TLShape)
      calls.push(`update(${edit.id})`)
      return editor
    },
    createShape: (shape: { id: string; type: string; props?: Record<string, unknown> }) => {
      shapes.set(shape.id, {
        id: shape.id,
        type: shape.type,
        parentId: PAGE,
        isLocked: false,
        meta: {},
        props: shape.props ?? {},
        x: 0,
        y: 0,
        rotation: 0
      } as unknown as TLShape)
      order.push(shape.id)
      calls.push(`create(${shape.type})`)
      return editor
    },
    reparentShapes: (moving: unknown, parentId: string) => {
      for (const id of ids(moving)) {
        const shape = shapes.get(id)
        if (shape) shapes.set(id, { ...shape, parentId } as TLShape)
      }
      calls.push(`reparent(${ids(moving).join(',')}->${parentId})`)
      return editor
    },
    toggleLock: (locking: unknown) => {
      for (const id of ids(locking)) {
        const shape = shapes.get(id)
        if (shape) shapes.set(id, { ...shape, isLocked: !shape.isLocked } as TLShape)
      }
      calls.push(`toggleLock(${ids(locking).join(',')})`)
      return editor
    },
    deleteShapes: note('delete'),
    duplicateShapes: note('duplicate'),
    bringToFront: note('bringToFront'),
    bringForward: note('bringForward'),
    sendBackward: note('sendBackward'),
    sendToBack: note('sendToBack'),
    groupShapes: note('group'),
    ungroupShapes: note('ungroup'),
    flipShapes: (shapesIn: unknown, how: string) => {
      calls.push(`flip(${how})`)
      return editor
    },
    rotateShapesBy: () => {
      calls.push('rotate()')
      return editor
    },
    getContentFromCurrentPage: (from: unknown) => ({ shapes: ids(from) }) as never,
    putContentOntoCurrentPage: (content: unknown, opts?: { point?: { x: number; y: number } }) => {
      calls.push(`paste(${opts?.point ? `${opts.point.x},${opts.point.y}` : ''})`)
      return editor
    },
    getSelectionPageBounds: () =>
      selected.length === 0 ? null : { minX: 10, minY: 20, maxX: 110, maxY: 220, width: 100, height: 200 },
    getViewportScreenBounds: () => ({ x: 0, y: 0, w: 1200, h: 800 }),
    getEditingShapeId: () => null,
    getShapesAtPoint: () => order.map(id => shapes.get(id)!),
    zoomToFit: () => {
      calls.push('zoomToFit()')
      return editor
    },
    zoomToSelection: () => {
      calls.push('zoomToSelection()')
      return editor
    },
    resetZoom: () => {
      calls.push('resetZoom()')
      return editor
    }
  } as unknown as Editor

  return {
    editor,
    calls,
    shapes,
    order,
    select: (...next: string[]) => {
      selected = next
    },
    shape: (id: string) => shapes.get(id as TLShapeId as string)!
  }
}
