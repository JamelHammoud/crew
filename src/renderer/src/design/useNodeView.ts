import { useEditor, useValue, type Editor, type TLFrameShape, type TLShape } from 'tldraw'
import type { DesignNodeShape } from './DesignNodeUtil'
import { designView } from './designView'
import { frameView } from './frameView'
import type { NodeView } from './nodeView'
import { paletteView } from './paletteView'

export function viewOf(editor: Editor, shape: TLShape): NodeView {
  if (shape.type === 'design-node') return designView(editor, shape as DesignNodeShape)
  if (shape.type === 'frame') return frameView(editor, shape as TLFrameShape)
  return paletteView(editor, shape)
}

export function useNodeView(): NodeView | null {
  const editor = useEditor()
  return useValue(
    'design node view',
    () => {
      const selected = editor.getSelectedShapes()
      return selected.length === 1 ? viewOf(editor, selected[0]) : null
    },
    [editor]
  )
}
