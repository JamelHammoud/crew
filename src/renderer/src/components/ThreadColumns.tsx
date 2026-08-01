import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { isFull, nearRight } from '../../../shared/threadViews'
import { ChatGlyph } from '../icons'
import { useCrew } from '../state/store'
import Chat from '../views/Chat'
import ThreadView from '../views/ThreadView'
import Tooltip from './Tooltip'


export const COLUMN_MIN = 400

export default function ThreadColumns({ ids }: { ids: string[] }) {
  const focused = useCrew(s => s.openThreadId)
  const focusThread = useCrew(s => s.focusThread)
  const chatColumn = useCrew(s => s.chatColumn)
  const setChatColumn = useCrew(s => s.setChatColumn)
  const [near, setNear] = useState(false)
  const many = ids.length > 1 || chatColumn
  const room = !isFull(ids)

  const watch = (event: ReactPointerEvent<HTMLDivElement>) => {
    setNear(nearRight(event.clientX, event.currentTarget.getBoundingClientRect().right))
  }

  return (
    <div className="h-full relative" onPointerMove={watch} onPointerLeave={() => setNear(false)}>
      <div className="h-full flex overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ids.map(id => (
          <div
            key={id}
            data-column={id}
            onPointerDownCapture={() => focusThread(id)}
            onFocusCapture={() => focusThread(id)}
            style={{ minWidth: COLUMN_MIN }}
            className="h-full flex-1 relative border-l border-ink-700 first:border-l-0"
          >
            <ThreadView threadId={id} many={many} focused={id === focused} />
          </div>
        ))}
        {chatColumn && room && (
          <div
            data-column="chat"
            style={{ minWidth: COLUMN_MIN }}
            className="h-full flex-1 relative border-l border-ink-700"
          >
            <Chat />
          </div>
        )}
      </div>
      {room && near && (
        <Tooltip
          label="Chat"
          className="absolute right-3 top-1/2 z-30 animate-edge"
        >
          <button
            onClick={() => setChatColumn(!chatColumn)}
            aria-label="Chat"
            aria-pressed={chatColumn}
            className={`glass w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-150 hover:bg-fg/[0.08] active:scale-95 ${
              chatColumn ? 'text-fg' : 'text-fg/70'
            }`}
          >
            <ChatGlyph className="w-5 h-5" />
          </button>
        </Tooltip>
      )}
    </div>
  )
}
