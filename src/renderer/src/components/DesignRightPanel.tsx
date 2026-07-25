import { useState } from 'react'
import { useEditor, useValue } from 'tldraw'
import Inspector, { useSelectedNode } from '../design/Inspector'
import ShapeStyles from '../design/ShapeStyles'
import DesignChat from './DesignChat'

type RightTab = 'design' | 'chat'

export default function DesignRightPanel({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const [tab, setTab] = useState<RightTab>('chat')

  return (
    <aside
      aria-label="Board panel"
      className="w-[340px] shrink-0 flex flex-col min-h-0 bg-ink-900 border-l border-ink-700"
    >
      <div className="flex gap-1 p-2 shrink-0">
        {(['design', 'chat'] as const).map(id => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`flex-1 h-7 rounded-full text-xs font-semibold capitalize transition-colors ${
              tab === id ? 'bg-fg text-ink-900' : 'text-fg-muted hover:text-fg hover:bg-fg/[0.06]'
            }`}
          >
            {id}
          </button>
        ))}
      </div>
      {tab === 'design' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <DesignTab />
        </div>
      ) : (
        <DesignChat key={boardId} boardId={boardId} onClose={onClose} />
      )}
    </aside>
  )
}

function DesignTab() {
  const editor = useEditor()
  const node = useSelectedNode()
  const count = useValue('design selection size', () => editor.getSelectedShapeIds().length, [editor])

  if (node) return <Inspector shape={node} />
  if (count > 0) return <ShapeStyles />
  return (
    <p className="px-4 py-8 text-xs text-fg-muted text-center">
      Pick a layer to see its size, color, corners, and layout.
    </p>
  )
}
