import { react } from '../../signals'
import { StateNode, type StateNodeConstructor } from '../state'
import { transformStates } from '../transforms'
import { Brushing } from './childStates/Brushing'
import { Crop } from './childStates/Crop'
import { EditingShape } from './childStates/EditingShape'
import { Idle } from './childStates/Idle'
import { PointingArrowLabel } from './childStates/PointingArrowLabel'
import { PointingCanvas } from './childStates/PointingCanvas'
import { PointingHandle } from './childStates/PointingHandle'
import { PointingResizeHandle } from './childStates/PointingResizeHandle'
import { PointingRotateHandle } from './childStates/PointingRotateHandle'
import { PointingSelection } from './childStates/PointingSelection'
import { PointingShape } from './childStates/PointingShape'
import { ScribbleBrushing } from './childStates/ScribbleBrushing'
import type { SelectEditor } from './types'

export const SELECT_BASE_STATES = [
  Idle,
  PointingCanvas,
  PointingShape,
  Brushing,
  ScribbleBrushing,
  PointingSelection,
  PointingResizeHandle,
  EditingShape,
  PointingRotateHandle,
  PointingArrowLabel,
  PointingHandle,
  Crop,
  ...transformStates()
] as StateNodeConstructor<SelectEditor>[]

export class SelectTool extends StateNode<SelectEditor> {
  static id = 'select'
  static initial = 'idle'
  static isLockable = false
  private cleanupDuplicatePropsReactor?: () => void

  static children(): StateNodeConstructor<SelectEditor>[] {
    return SELECT_BASE_STATES
  }

  onEnter(): void {
    this.cleanupDuplicatePropsReactor = react('clean duplicate props', () => this.cleanUpDuplicateProps())
  }

  onExit(): void {
    this.cleanupDuplicatePropsReactor?.()
    if (this.editor.getCurrentPageState().editingShapeId) this.editor.setEditingShape(null)
  }

  private cleanUpDuplicateProps(): void {
    const selected = this.editor.getSelectedShapeIds()
    const duplicateProps = this.editor.getInstanceState().duplicateProps
    if (!duplicateProps) return
    const duplicated = new Set(duplicateProps.shapeIds)
    if (selected.length === duplicated.size && selected.every((id: any) => duplicated.has(id))) return
    this.editor.updateInstanceState({ duplicateProps: null })
  }
}
