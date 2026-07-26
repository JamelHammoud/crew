import { useEditor, useValue, type TLShape } from 'tldraw'
import FrameStyles, { useSelectedFrame } from './FrameStyles'
import { glyphForShape } from './glyphs'
import Inspector, { useSelectedNode } from './Inspector'
import { Section } from './InspectorFields'
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
      <SelectionHeader shapes={shapes} />
      <div className="design-style-panel flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-4 px-3 pb-4">
        <Transform />
        <Opacity />
        {node ? <Inspector shape={node} /> : frame ? <FrameStyles shape={frame} /> : <ShapeStyles />}
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
        <span className="text-xs font-semibold text-fg-muted">{shapes.length} layers</span>
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
          className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-fg outline-none"
        />
      ) : (
        <span className="flex-1 min-w-0 truncate text-xs font-semibold text-fg capitalize">{layerName(only)}</span>
      )}
    </div>
  )
}

function Opacity() {
  const editor = useEditor()
  const opacity = useValue('design opacity', () => editor.getSharedOpacity(), [editor])
  const value = opacity.type === 'shared' ? opacity.value : 1

  const set = (next: number) => {
    editor.run(() => {
      editor.setOpacityForSelectedShapes(next)
      editor.setOpacityForNextShapes(next)
    })
  }

  return (
    <Section label="Appearance">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.01}
          value={value}
          onChange={event => set(Number(event.target.value))}
          aria-label="Opacity"
          className="flex-1 min-w-0"
        />
        <span className="w-9 text-right text-xs tabular-nums text-fg-muted">{Math.round(value * 100)}%</span>
      </div>
    </Section>
  )
}
