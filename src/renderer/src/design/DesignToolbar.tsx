import {
  ArrowLongRightIcon,
  Bars3BottomLeftIcon,
  ChatBubbleLeftEllipsisIcon,
  CubeTransparentIcon,
  CursorArrowRaysIcon,
  HandRaisedIcon,
  PencilIcon,
  RectangleGroupIcon,
  StopCircleIcon,
  StopIcon
} from '@heroicons/react/24/outline'
import { useEditor, useValue } from 'tldraw'
import Tooltip from '../components/Tooltip'

const TOOLS = [
  { id: 'select', label: 'Move', key: 'V', Icon: CursorArrowRaysIcon },
  { id: 'hand', label: 'Hand', key: 'H', Icon: HandRaisedIcon },
  { divider: true },
  { id: 'node-frame', label: 'Frame', key: 'F', Icon: RectangleGroupIcon },
  { id: 'node-box', label: 'Rectangle', key: 'R', Icon: StopIcon },
  { id: 'node-ellipse', label: 'Ellipse', key: 'O', Icon: StopCircleIcon },
  { id: 'node-text', label: 'Text', key: 'T', Icon: Bars3BottomLeftIcon },
  { id: 'node-glass', label: 'Glass panel', key: 'G', Icon: CubeTransparentIcon },
  { divider: true },
  { id: 'draw', label: 'Pencil', key: 'P', Icon: PencilIcon },
  { id: 'arrow', label: 'Arrow', key: 'A', Icon: ArrowLongRightIcon },
  { id: 'note', label: 'Note', key: 'N', Icon: ChatBubbleLeftEllipsisIcon }
] as const

export default function DesignToolbar() {
  const editor = useEditor()
  const current = useValue('design tool', () => editor.getCurrentToolId(), [editor])
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto">
      <div className="glass rounded-full h-12 flex items-center gap-0.5 px-1.5">
        {TOOLS.map((tool, at) =>
          'divider' in tool ? (
            <span key={at} className="w-px h-4 bg-fg/10 mx-1 shrink-0" />
          ) : (
            <Tooltip key={tool.id} label={`${tool.label}  ${tool.key}`}>
              <button
                onClick={() => editor.setCurrentTool(tool.id)}
                aria-label={tool.label}
                aria-pressed={current === tool.id}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                  current === tool.id ? 'bg-fg text-ink-900' : 'text-fg-muted hover:text-fg hover:bg-fg/[0.06]'
                }`}
              >
                <tool.Icon className="w-5 h-5" strokeWidth={1.8} />
              </button>
            </Tooltip>
          )
        )}
      </div>
    </div>
  )
}
