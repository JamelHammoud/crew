import type { Editor, TLShapeId } from 'tldraw'

const KEY = 'crew.design.view'
const BOARDS = 24
const SAVE_MS = 400

type Camera = { x: number; y: number; z: number }

type BoardView = { camera: Camera; selection: string[] }

type Panels = { left: boolean; right: boolean }

type Memory = { board: string | null; boards: Record<string, BoardView> } & Panels

type Changes = {
  added: Record<string, unknown>
  updated: Record<string, unknown>
  removed: Record<string, unknown>
}

const blank: Memory = { board: null, left: true, right: true, boards: {} }

function cameraIn(camera: unknown): Camera | null {
  const { x, y, z } = (camera ?? {}) as Camera
  if (![x, y, z].every(value => typeof value === 'number' && Number.isFinite(value))) return null
  return z > 0 ? { x, y, z } : null
}

function boardsIn(boards: unknown): Record<string, BoardView> {
  if (!boards || typeof boards !== 'object') return {}
  const kept: Record<string, BoardView> = {}
  for (const [id, value] of Object.entries(boards as Record<string, Partial<BoardView>>)) {
    const camera = cameraIn(value?.camera)
    if (!camera) continue
    const selection = Array.isArray(value?.selection) ? value.selection : []
    kept[id] = { camera, selection: selection.filter(shape => typeof shape === 'string') }
  }
  return kept
}

function read(): Memory {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return blank
    const parsed = JSON.parse(raw) as Partial<Memory>
    return {
      board: typeof parsed.board === 'string' ? parsed.board : null,
      left: parsed.left !== false,
      right: parsed.right !== false,
      boards: boardsIn(parsed.boards)
    }
  } catch {
    return blank
  }
}

function write(memory: Memory): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(memory))
  } catch {
    return
  }
}

function newest(boards: Record<string, BoardView>): Record<string, BoardView> {
  const ids = Object.keys(boards)
  if (ids.length <= BOARDS) return boards
  const kept: Record<string, BoardView> = {}
  for (const id of ids.slice(ids.length - BOARDS)) kept[id] = boards[id]
  return kept
}

export function lastBoard(): string | null {
  return read().board
}

export function rememberBoard(board: string): void {
  const memory = read()
  if (memory.board === board) return
  write({ ...memory, board })
}

export function lastPanels(): Panels {
  const { left, right } = read()
  return { left, right }
}

export function rememberPanels(panels: Panels): void {
  const memory = read()
  if (memory.left === panels.left && memory.right === panels.right) return
  write({ ...memory, ...panels })
}

export function restoreView(editor: Editor, boardId: string): void {
  const view = read().boards[boardId]
  if (!view) return
  editor.setCamera(view.camera, { immediate: true })
  const shapes = view.selection.filter(id => editor.getShape(id as TLShapeId)) as TLShapeId[]
  if (shapes.length > 0) editor.setSelectedShapes(shapes)
}

export function rememberView(editor: Editor, boardId: string): void {
  try {
    const camera = cameraIn(editor.getCamera())
    if (!camera) return
    const memory = read()
    const boards = { ...memory.boards }
    delete boards[boardId]
    boards[boardId] = { camera, selection: editor.getSelectedShapeIds() as string[] }
    write({ ...memory, boards: newest(boards) })
  } catch {
    return
  }
}

export function viewChanged(changes: Changes): boolean {
  const ids = [
    ...Object.keys(changes.added),
    ...Object.keys(changes.updated),
    ...Object.keys(changes.removed)
  ]
  return ids.some(id => id.startsWith('camera:') || id.startsWith('instance_page_state:'))
}

export function watchView(editor: Editor, boardId: string): () => void {
  let timer: number | null = null
  const stop = editor.store.listen(
    entry => {
      if (timer !== null || !viewChanged(entry.changes)) return
      timer = window.setTimeout(() => {
        timer = null
        rememberView(editor, boardId)
      }, SAVE_MS)
    },
    { scope: 'session' }
  )
  return () => {
    stop()
    if (timer !== null) window.clearTimeout(timer)
    rememberView(editor, boardId)
  }
}
