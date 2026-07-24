import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { useMemo, useState } from 'react'
import DesignCanvas from '../components/DesignCanvas'
import DesignChat from '../components/DesignChat'
import { DesignBoardContext } from '../components/DesignPanels'
import Tooltip from '../components/Tooltip'
import { useCrew } from '../state/store'

export default function Design() {
  const boards = useCrew(s => s.boards)
  const createBoard = useCrew(s => s.createBoard)
  const [selected, setSelected] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(true)

  const current = selected && boards.some(b => b.id === selected) ? selected : (boards[0]?.id ?? null)
  const boardContext = useMemo(() => ({ current: current ?? '', select: setSelected }), [current])

  return (
    <DesignBoardContext.Provider value={boardContext}>
      <div className="h-full flex">
        <div className="flex-1 min-w-0 relative">
          {current ? (
            <div
              className={`absolute left-6 top-20 bottom-6 rounded-card overflow-hidden ${
                chatOpen ? 'right-0' : 'right-6'
              }`}
            >
              <DesignCanvas key={current} boardId={current} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
              <p className="text-base text-fg-muted max-w-sm">
                Sketch screens and diagrams together. Agents you mention in board chat draw here too, cursors and
                all.
              </p>
              <button
                onClick={() => setSelected(createBoard('Untitled'))}
                className="h-10 px-5 rounded-full bg-fg text-ink-900 text-base font-semibold transition-all duration-150 hover:scale-105 active:scale-95"
              >
                New board
              </button>
            </div>
          )}
          {current && !chatOpen && (
            <Tooltip label="Board chat">
              <button
                onClick={() => setChatOpen(true)}
                aria-label="Board chat"
                className="absolute bottom-12 right-12 w-11 h-11 rounded-full glass text-fg flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95"
              >
                <ChatBubbleLeftRightIcon className="w-5 h-5" strokeWidth={1.8} />
              </button>
            </Tooltip>
          )}
        </div>
        {current && chatOpen && <DesignChat key={current} boardId={current} onClose={() => setChatOpen(false)} />}
      </div>
    </DesignBoardContext.Provider>
  )
}
