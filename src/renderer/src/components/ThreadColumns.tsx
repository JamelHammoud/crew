import { isFull } from '../../../shared/threadViews'
import { ChatGlyph } from '../icons'
import { useCrew } from '../state/store'
import Chat from '../views/Chat'
import ThreadView from '../views/ThreadView'
import Tooltip from './Tooltip'


export const COLUMN_MIN = 400
export const SLOT_W = 44

export default function ThreadColumns({ ids }: { ids: string[] }) {
  const focused = useCrew(s => s.openThreadId)
  const focusThread = useCrew(s => s.focusThread)
  const chatColumn = useCrew(s => s.chatColumn)
  const setChatColumn = useCrew(s => s.setChatColumn)
  const many = ids.length > 1 || chatColumn
  const room = !isFull(ids)

  return (
    <div className="h-full flex overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ids.map(id => (
        <div
          key={id}
          onPointerDownCapture={() => focusThread(id)}
          onFocusCapture={() => focusThread(id)}
          style={{ minWidth: COLUMN_MIN }}
          className="h-full flex-1 relative border-l border-ink-700 first:border-l-0"
        >
          <ThreadView threadId={id} many={many} focused={id === focused} />
        </div>
      ))}
      {chatColumn && room && (
        <div style={{ minWidth: COLUMN_MIN }} className="h-full flex-1 relative border-l border-ink-700">
          <Chat />
        </div>
      )}
      {room && (
        <div style={{ width: SLOT_W }} className="h-full shrink-0 border-l border-ink-700 flex items-center justify-center">
          <Tooltip label="The chat">
            <button
              onClick={() => setChatColumn(!chatColumn)}
              aria-label="The chat"
              aria-pressed={chatColumn}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-150 hover:bg-fg/[0.06] active:scale-95 ${
                chatColumn ? 'text-fg' : 'text-fg-faint'
              }`}
            >
              <ChatGlyph className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
