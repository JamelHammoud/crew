import { PlusIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import DesignChat, { useBoardThreads } from './DesignChat'
import { PanelButton } from './DesignControls'

export default function DesignRightPanel({ boardId }: { boardId: string }) {
  const [composeNew, setComposeNew] = useState(false)
  const boardThreads = useBoardThreads(boardId)

  return (
    <aside
      aria-label="Board chat"
      className="w-[340px] shrink-0 flex flex-col min-w-0 min-h-0 overflow-hidden bg-ink-900 border-l border-ink-700"
    >
      {boardThreads.length > 0 && (
        <div className="h-12 shrink-0 flex items-center justify-end pr-2">
          <PanelButton label="New thread" onClick={() => setComposeNew(true)}>
            <PlusIcon className="w-4 h-4" />
          </PanelButton>
        </div>
      )}
      <DesignChat key={boardId} boardId={boardId} composeNew={composeNew} onComposeNew={setComposeNew} />
    </aside>
  )
}
