import { useEditor, useValue, type TLShape } from 'tldraw'
import Appearance from './Appearance'
import FrameStyles, { useSelectedFrame } from './FrameStyles'
import { glyphForShape } from './glyphs'
import Inspector, { useSelectedNode } from './Inspector'
import ShapeStyles from './ShapeStyles'
import { canRename, layerName, renameShape } from './tools'
import Transform from './Transform'

export default function DesignPanel() {
  const editor = useEditor()
  const shapes = useValue('design selected shapes', () => editor.getSelectedShapes(), [editor])
  const node = useSelectedNode()
  const frame = useSelectedFrame()

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="design-style-panel flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <SelectionHeader shapes={shapes} />
        <Transform />
        <Appearance node={node} />
        {node ? <Inspector shape={node} /> : frame ? <FrameStyles shape={frame} /> : <ShapeStyles />}
        <div className="h-6" />
      </div>
    </div>
  )
}

function SelectionHeader({ shapes }: { shapes: TLShape[] }) {
  const editor = useEditor()
  const only = shapes.length === 1 ? shapes[0] : null

  if (!only) {
    return (
      <div className="h-12 shrink-0 flex items-center px-4">
        <span className="text-sm font-semibold text-fg">{shapes.length} layers</span>
      </div>
    )
  }

  const Glyph = glyphForShape(only)
  return (
    <div className="h-12 shrink-0 flex items-center gap-2 px-4 min-w-0">
      <Glyph className="w-4 h-4 shrink-0 text-fg-muted" />
      {canRename(only) ? (
        <input
          value={layerName(only)}
          onChange={event => renameShape(editor, only, event.target.value)}
          aria-label="Layer name"
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-fg outline-none"
        />
      ) : (
        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-fg capitalize">{layerName(only)}</span>
      )}
    </div>
  )
}
