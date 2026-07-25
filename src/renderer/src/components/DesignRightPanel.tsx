import { PlusIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import DesignChat, { useBoardThreads } from './DesignChat'
import { PanelButton } from './DesignControls'

export default function DesignRightPanel({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const [composeNew, setComposeNew] = useState(false)
  const boardThreads = useBoardThreads(boardId)

  return (
    <aside
      aria-label="Board chat"
      className="w-[340px] shrink-0 flex flex-col min-w-0 min-h-0 overflow-hidden bg-ink-900 border-l border-ink-700"
    >
      <div className="h-12 shrink-0 flex items-center gap-1 pl-4 pr-2">
        <span className="flex-1 text-xs font-semibold text-fg-muted">Chat</span>
        {boardThreads.length > 0 && (
          <PanelButton label="New thread" onClick={() => setComposeNew(true)}>
            <PlusIcon className="w-4 h-4" />
          </PanelButton>
        )}
        <PanelButton label="Hide chat" onClick={onClose}>
          <XMarkIcon className="w-4 h-4" />
        </PanelButton>
      </div>
      <DesignChat key={boardId} boardId={boardId} composeNew={composeNew} onComposeNew={setComposeNew} />
    </aside>
  )
}
