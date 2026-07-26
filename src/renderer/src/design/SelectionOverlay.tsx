import { useValue, type Editor } from 'tldraw'
import type { Corner, DesignNodeProps } from '../../../shared/designNode'
import type { DesignNodeShape } from './DesignNodeUtil'
import { selectionStroke } from './selectionColor'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const CORNERS: Array<{ at: number; label: string; left: boolean; top: boolean }> = [
  { at: 0, label: 'Top left corner', left: true, top: true },
  { at: 1, label: 'Top right corner', left: false, top: true },
  { at: 2, label: 'Bottom right corner', left: false, top: false },
  { at: 3, label: 'Bottom left corner', left: true, top: false }
]

const MIN_FOR_HANDLES = 72

export default function SelectionOverlay({ editor }: { editor: Editor | null }) {
  const view = useValue(
    'design selection overlay',
    () => {
      if (!editor || !editor.isIn('select') || editor.getEditingShapeId()) return null
      const shapes = editor.getSelectedShapes()
      if (shapes.length === 0) return null
      const bounds = editor.getSelectionPageBounds()
      if (!bounds) return null
      const topLeft = editor.pageToViewport({ x: bounds.minX, y: bounds.minY })
      const bottomRight = editor.pageToViewport({ x: bounds.maxX, y: bounds.maxY })
      const only = shapes.length === 1 ? shapes[0] : null
      return {
        rect: { x: topLeft.x, y: topLeft.y, w: bottomRight.x - topLeft.x, h: bottomRight.y - topLeft.y } as Rect,
        size: { w: bounds.w, h: bounds.h },
        zoom: editor.getZoomLevel(),
        stroke: selectionStroke(editor),
        node: only && only.type === 'design-node' && only.rotation === 0 ? (only as DesignNodeShape) : null
      }
    },
    [editor]
  )

  if (!editor || !view) return null
  const { rect, size, node, zoom, stroke } = view

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {node && rect.w > MIN_FOR_HANDLES && rect.h > MIN_FOR_HANDLES && (
        <RadiusHandles editor={editor} shape={node} rect={rect} zoom={zoom} stroke={stroke} />
      )}
      <span
        className="absolute -translate-x-1/2 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums text-white whitespace-nowrap"
        style={{ left: rect.x + rect.w / 2, top: rect.y + rect.h + 10, background: stroke }}
      >
        {Math.round(size.w)} × {Math.round(size.h)}
      </span>
    </div>
  )
}

function RadiusHandles({
  editor,
  shape,
  rect,
  zoom,
  stroke
}: {
  editor: Editor
  shape: DesignNodeShape
  rect: Rect
  zoom: number
  stroke: string
}) {
  const props = shape.props as DesignNodeProps
  const limit = Math.min(props.w, props.h) / 2

  const drag = (event: React.PointerEvent, at: number) => {
    event.preventDefault()
    event.stopPropagation()
    const bounds = editor.getShapePageBounds(shape.id)
    if (!bounds) return
    editor.markHistoryStoppingPoint()
    const corner = CORNERS[at]

    const move = (moved: PointerEvent) => {
      const point = editor.screenToPage({ x: moved.clientX, y: moved.clientY })
      const dx = corner.left ? point.x - bounds.minX : bounds.maxX - point.x
      const dy = corner.top ? point.y - bounds.minY : bounds.maxY - point.y
      const next = Math.round(Math.max(0, Math.min(limit, Math.min(dx, dy))))
      const radius = [next, next, next, next] as Corner
      editor.updateShape({ id: shape.id, type: 'design-node', props: { ...props, radius } })
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <>
      {CORNERS.map(corner => {
        const inset = Math.max(11, Math.min(props.radius[corner.at] * zoom, Math.min(rect.w, rect.h) / 2 - 6))
        return (
          <button
            key={corner.at}
            aria-label={corner.label}
            onPointerDown={event => drag(event, corner.at)}
            className="group absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 grid place-items-center pointer-events-auto"
            style={{
              left: corner.left ? rect.x + inset : rect.x + rect.w - inset,
              top: corner.top ? rect.y + inset : rect.y + rect.h - inset
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full bg-white transition-transform group-hover:scale-125"
              style={{ border: `1.5px solid ${stroke}` }}
            />
          </button>
        )
      })}
    </>
  )
}
