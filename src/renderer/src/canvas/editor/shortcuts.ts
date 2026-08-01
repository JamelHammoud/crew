import { Box } from '../math'
import type { TLShapeId } from '../schema'

export interface ShortcutEditor {
  getIsReadonly(): boolean
  getEditingShapeId(): TLShapeId | null
  getSelectedShapeIds(): TLShapeId[]
  getShapePageBounds(id: TLShapeId): Box | undefined
  getCurrentToolId(): string
  isTextInputFocused(): boolean
  markHistoryStoppingPoint(name?: string): string
  deleteShapes(ids: readonly TLShapeId[]): unknown
  duplicateShapes(ids: readonly TLShapeId[], offset: { x: number; y: number }): unknown
  groupShapes(ids: readonly TLShapeId[]): unknown
  ungroupShapes(ids: readonly TLShapeId[]): unknown
  options: Record<string, unknown>
  user: { getAreKeyboardShortcutsEnabled(): boolean }
}

export function handleShortcut(editor: ShortcutEditor, event: KeyboardEvent): boolean {
  if (!editor.user.getAreKeyboardShortcutsEnabled()) return false
  if (editor.getIsReadonly() || editor.getEditingShapeId() || editor.isTextInputFocused()) return false
  if (!editor.getCurrentToolId().startsWith('select')) return false
  const ids = editor.getSelectedShapeIds()
  const accel = event.metaKey || event.ctrlKey

  if (!accel && (event.key === 'Delete' || event.key === 'Backspace')) {
    if (ids.length === 0) return false
    editor.markHistoryStoppingPoint('delete')
    editor.deleteShapes(ids)
    return true
  }

  if (!accel || event.altKey) return false
  const key = event.key.toLowerCase()

  if (key === 'a' && !event.shiftKey) {
    editor.selectAll()
    return true
  }

  if (key === 'd' && !event.shiftKey) {
    if (ids.length === 0) return false
    editor.markHistoryStoppingPoint('duplicate shapes')
    editor.duplicateShapes(ids, duplicateOffset(editor, ids))
    return true
  }

  if (key === 'g') {
    if (ids.length === 0) return false
    editor.markHistoryStoppingPoint(event.shiftKey ? 'ungroup' : 'group')
    if (event.shiftKey) editor.ungroupShapes(ids)
    else editor.groupShapes(ids)
    return true
  }

  return false
}

function duplicateOffset(editor: ShortcutEditor, ids: readonly TLShapeId[]): { x: number; y: number } {
  const margin = (editor.options.adjacentShapeMargin as number) ?? 20
  const bounds = ids.map(id => editor.getShapePageBounds(id)).filter((value): value is Box => value !== undefined)
  if (bounds.length === 0) return { x: margin, y: margin }
  return { x: Box.Common(bounds).w + margin, y: 0 }
}
