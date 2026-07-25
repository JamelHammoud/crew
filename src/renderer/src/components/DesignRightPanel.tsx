import { PlusIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { useEditor, useValue } from 'tldraw'
import FrameStyles, { useSelectedFrame } from '../design/FrameStyles'
import Inspector, { useSelectedNode } from '../design/Inspector'
import ShapeStyles from '../design/ShapeStyles'
import DesignChat, { useBoardThreads } from './DesignChat'
import { PanelButton, PanelTabs } from './DesignControls'

type RightTab = 'design' | 'chat'

const TABS: ReadonlyArray<{ id: RightTab; label: string }> = [
  { id: 'design', label: 'Design' },
  { id: 'chat', label: 'Chat' }
]

export default function DesignRightPanel({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const [tab, setTab] = useState<RightTab>('chat')
  const [composeNew, setComposeNew] = useState(false)
  const boardThreads = useBoardThreads(boardId)

  return (
    <aside
      aria-label="Board panel"
      className="w-[340px] shrink-0 flex flex-col min-w-0 min-h-0 overflow-hidden bg-ink-900 border-l border-ink-700"
    >
      <div className="h-12 shrink-0 flex items-center gap-1 pl-3 pr-2">
        <PanelTabs tabs={TABS} current={tab} onPick={setTab} />
        {tab === 'chat' && boardThreads.length > 0 && (
          <PanelButton label="New thread" onClick={() => setComposeNew(true)}>
            <PlusIcon className="w-4 h-4" />
          </PanelButton>
        )}
        <PanelButton label="Hide panel" onClick={onClose}>
          <XMarkIcon className="w-4 h-4" />
        </PanelButton>
      </div>
      {tab === 'design' ? (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <DesignTab />
        </div>
      ) : (
        <DesignChat key={boardId} boardId={boardId} composeNew={composeNew} onComposeNew={setComposeNew} />
      )}
    </aside>
  )
}

function DesignTab() {
  const editor = useEditor()
  const node = useSelectedNode()
  const frame = useSelectedFrame()
  const count = useValue('design selection size', () => editor.getSelectedShapeIds().length, [editor])

  if (node) return <Inspector shape={node} />
  if (frame) return <FrameStyles shape={frame} />
  if (count > 0) return <ShapeStyles />
  return (
    <p className="px-6 py-10 text-xs text-fg-muted text-center leading-5">
      Pick a layer to see its size, color, corners, and layout.
    </p>
  )
}
