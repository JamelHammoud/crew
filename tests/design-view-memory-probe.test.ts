// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from 'tldraw'
import {
  lastBoard,
  lastPanels,
  rememberBoard,
  rememberPanels,
  rememberView,
  restoreView,
  viewChanged,
  watchView
} from '../src/renderer/src/design/viewMemory'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear()
})

type Listener = (entry: { changes: Changes }) => void
type Changes = {
  added: Record<string, unknown>
  updated: Record<string, unknown>
  removed: Record<string, unknown>
}

function canvas(camera = { x: 0, y: 0, z: 1 }, shapes: string[] = []) {
  let selection: string[] = []
  const listeners = new Set<Listener>()
  const editor = {
    getCamera: () => ({ id: 'camera:page', typeName: 'camera', ...camera }),
    setCamera: (next: { x: number; y: number; z: number }) => {
      camera = { x: next.x, y: next.y, z: next.z }
      return editor
    },
    getShape: (id: string) => (shapes.includes(id) ? { id } : undefined),
    getSelectedShapeIds: () => selection,
    setSelectedShapes: (ids: string[]) => {
      selection = ids
      return editor
    },
    store: {
      listen: (listener: Listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
    }
  }
  return {
    editor: editor as unknown as Editor,
    camera: () => camera,
    selection: () => selection,
    select: (ids: string[]) => {
      selection = ids
    },
    moves: (next: { x: number; y: number; z: number }) => {
      camera = next
      for (const listener of listeners) listener({ changes: changed('camera:page') })
    }
  }
}

function changed(...ids: string[]): Changes {
  return { added: {}, updated: Object.fromEntries(ids.map(id => [id, []])), removed: {} }
}

describe('design view memory', () => {
  beforeEach(() => {
    store.clear()
    vi.useRealTimers()
  })

  it('opens with no board and both panels showing before anything is remembered', () => {
    expect(lastBoard()).toBe(null)
    expect(lastPanels()).toEqual({ left: true, right: true })
  })

  it('comes back to the board that was open', () => {
    rememberBoard('board-two')
    expect(lastBoard()).toBe('board-two')
  })

  it('comes back with the panels the way they were left', () => {
    rememberPanels({ left: false, right: true })
    expect(lastPanels()).toEqual({ left: false, right: true })
  })

  it('keeps the panels when the board changes', () => {
    rememberPanels({ left: false, right: false })
    rememberBoard('board-one')
    expect(lastPanels()).toEqual({ left: false, right: false })
    expect(lastBoard()).toBe('board-one')
  })

  it('puts the camera back where it was', () => {
    const left = canvas({ x: -420, y: 96, z: 2.5 })
    rememberView(left.editor, 'board-one')
    const back = canvas()
    restoreView(back.editor, 'board-one')
    expect(back.camera()).toEqual({ x: -420, y: 96, z: 2.5 })
  })

  it('holds a camera per board', () => {
    const one = canvas({ x: 10, y: 10, z: 1 })
    rememberView(one.editor, 'board-one')
    const two = canvas({ x: 300, y: 40, z: 0.5 })
    rememberView(two.editor, 'board-two')
    const back = canvas()
    restoreView(back.editor, 'board-one')
    expect(back.camera()).toEqual({ x: 10, y: 10, z: 1 })
  })

  it('leaves a board it has never seen at the default camera', () => {
    const board = canvas({ x: 0, y: 0, z: 1 })
    restoreView(board.editor, 'board-new')
    expect(board.camera()).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('puts the selection back', () => {
    const before = canvas({ x: 0, y: 0, z: 1 }, ['shape:card'])
    before.select(['shape:card'])
    rememberView(before.editor, 'board-one')
    const after = canvas({ x: 0, y: 0, z: 1 }, ['shape:card'])
    restoreView(after.editor, 'board-one')
    expect(after.selection()).toEqual(['shape:card'])
  })

  it('skips shapes someone deleted while the board was closed', () => {
    const before = canvas({ x: 0, y: 0, z: 1 }, ['shape:card', 'shape:gone'])
    before.select(['shape:card', 'shape:gone'])
    rememberView(before.editor, 'board-one')
    const after = canvas({ x: 0, y: 0, z: 1 }, ['shape:card'])
    restoreView(after.editor, 'board-one')
    expect(after.selection()).toEqual(['shape:card'])
  })

  it('only remembers the last handful of boards', () => {
    for (let index = 0; index < 30; index++) {
      rememberView(canvas({ x: index, y: 0, z: 1 }).editor, `board-${index}`)
    }
    const oldest = canvas()
    restoreView(oldest.editor, 'board-0')
    expect(oldest.camera()).toEqual({ x: 0, y: 0, z: 1 })
    const newest = canvas()
    restoreView(newest.editor, 'board-29')
    expect(newest.camera()).toEqual({ x: 29, y: 0, z: 1 })
  })

  it('saves the camera a moment after it stops moving', () => {
    vi.useFakeTimers()
    const board = canvas({ x: 0, y: 0, z: 1 })
    const stop = watchView(board.editor, 'board-one')
    board.moves({ x: 120, y: 60, z: 1.5 })
    vi.advanceTimersByTime(500)
    stop()
    const back = canvas()
    restoreView(back.editor, 'board-one')
    expect(back.camera()).toEqual({ x: 120, y: 60, z: 1.5 })
  })

  it('saves the camera when the board is closed before the timer runs', () => {
    vi.useFakeTimers()
    const board = canvas({ x: 0, y: 0, z: 1 })
    const stop = watchView(board.editor, 'board-one')
    board.moves({ x: 7, y: 8, z: 3 })
    stop()
    const back = canvas()
    restoreView(back.editor, 'board-one')
    expect(back.camera()).toEqual({ x: 7, y: 8, z: 3 })
  })

  it('ignores changes that are not the camera or the selection', () => {
    expect(viewChanged(changed('pointer:pointer'))).toBe(false)
    expect(viewChanged(changed('camera:page'))).toBe(true)
    expect(viewChanged(changed('instance_page_state:page'))).toBe(true)
  })

  it('starts fresh when the stored view is unreadable', () => {
    store.set('crew.design.view', '{ not json')
    expect(lastBoard()).toBe(null)
    expect(lastPanels()).toEqual({ left: true, right: true })
  })

  it('ignores a stored camera that makes no sense', () => {
    store.set(
      'crew.design.view',
      JSON.stringify({ boards: { 'board-one': { camera: { x: 0, y: 0, z: 0 }, selection: [] } } })
    )
    const board = canvas({ x: 5, y: 5, z: 1 })
    restoreView(board.editor, 'board-one')
    expect(board.camera()).toEqual({ x: 5, y: 5, z: 1 })
  })
})
