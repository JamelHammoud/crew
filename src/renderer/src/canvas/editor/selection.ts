import { atom, type Atom } from '../signals'
import type { TLPageId, TLShapeId } from '../schema'

export class SelectionManager {
  private readonly selected: Atom<TLShapeId[]>
  private readonly editing: Atom<TLShapeId | null>
  private readonly focusedGroup: Atom<TLShapeId | null>

  constructor() {
    this.selected = atom('editor.selectedShapeIds', [])
    this.editing = atom('editor.editingShapeId', null)
    this.focusedGroup = atom('editor.focusedGroupId', null)
  }

  getSelectedShapeIds(): TLShapeId[] {
    return this.selected.get()
  }

  setSelectedShapeIds(ids: TLShapeId[]): void {
    this.selected.set([...new Set(ids)])
  }

  getEditingShapeId(): TLShapeId | null {
    return this.editing.get()
  }

  setEditingShapeId(id: TLShapeId | null): void {
    this.editing.set(id)
  }

  getFocusedGroupId(pageId: TLPageId): TLShapeId | TLPageId {
    return this.focusedGroup.get() ?? pageId
  }

  setFocusedGroupId(id: TLShapeId | null): void {
    this.focusedGroup.set(id)
  }
}
