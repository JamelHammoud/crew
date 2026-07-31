import { DrawTool } from '../draw/DrawTool'
import type { FreehandEditor } from '../draw/types'

export class HighlightTool extends DrawTool {
  static readonly id: string = 'highlight'
  static readonly initial = 'idle'
  static readonly isLockable = false
  static readonly useCoalescedEvents = true

  constructor(editor: FreehandEditor) {
    super(editor, 'highlight')
  }
}
