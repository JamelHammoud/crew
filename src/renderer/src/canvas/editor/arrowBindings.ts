import type { TLBinding } from '../schema'
import type { BindingBehavior, BindingEditor } from './bindingTypes'

function terminalOf(binding: TLBinding): 'start' | 'end' | undefined {
  const terminal = (binding.props as { terminal?: unknown }).terminal
  return terminal === 'start' || terminal === 'end' ? terminal : undefined
}

function freezeTerminal(editor: BindingEditor, binding: TLBinding): void {
  const terminal = terminalOf(binding)
  if (!terminal) return
  const arrow = editor.getShape(binding.fromId)
  if (!arrow) return
  const handle = editor.getShapeHandles(arrow)?.find(candidate => candidate.id === terminal)
  if (!handle || !Number.isFinite(handle.x) || !Number.isFinite(handle.y)) return
  editor.updateShape({ id: arrow.id, type: arrow.type, props: { [terminal]: { x: handle.x, y: handle.y } } })
}

export const arrowBindingBehavior: BindingBehavior = {
  onBeforeIsolateFromShape(editor, binding) {
    freezeTerminal(editor, binding)
  },
  onBeforeIsolateToShape(editor, binding) {
    freezeTerminal(editor, binding)
  }
}
