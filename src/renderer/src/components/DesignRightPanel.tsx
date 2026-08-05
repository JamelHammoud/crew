import { BOARD_CHAT_MARK } from '../design/designKeys'
import DesignChat from './DesignChat'

export default function DesignRightPanel({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  return (
    <aside
      aria-label="Board chat"
      {...{ [BOARD_CHAT_MARK]: '' }}
      className="w-[340px] shrink-0 flex flex-col min-w-0 min-h-0 overflow-hidden bg-ink-900 border-l border-ink-700"
    >
      <DesignChat key={boardId} boardId={boardId} onClose={onClose} />
    </aside>
  )
}
