import type { Editor, TLFrameShape } from 'tldraw'
import { frameBackground } from './frameFill'
import { emptyView, type NodeView } from './nodeView'

export function frameView(editor: Editor, shape: TLFrameShape): NodeView {
  const view = emptyView(shape.id)
  view.fills = {
    items: [{ type: 'solid', color: frameBackground(shape.meta), opacity: 1, visible: true }],
    set: (_at, paint) => {
      if (paint.type !== 'solid') return
      editor.markHistoryStoppingPoint()
      editor.updateShape({ id: shape.id, type: 'frame', meta: { background: paint.color } })
    },
    opacity: false,
    hide: false
  }
  return view
}
