import { memo } from 'react'
import { FrameGlyph } from '../design/glyphs'
import { useCrew } from '../state/store'
import HoverCard from './HoverCard'
import { BoardCardContent } from './Mention'
import { sameItem, type ThreadItem } from './thread'

function DesignChip({ item }: { item: ThreadItem }) {
  const boardId = item.design?.boardId ?? ''
  const action = item.design?.action ?? 'read'
  const board = useCrew(state => state.boards.find(one => one.id === boardId))
  const openBoard = useCrew(state => state.openBoard)
  const status =
    action === 'edit' ? (item.streaming ? 'Editing' : 'Edited') : item.streaming ? 'Reading' : 'Read'
  const chip = (
    <button
      type="button"
      disabled={!board}
      onClick={() => board && openBoard(boardId)}
      className="group flex min-w-0 max-w-full items-center gap-2 pl-2 pr-3 py-1 rounded-full border border-ink-700 bg-ink-800/60 transition-all enabled:active:scale-[0.98] enabled:hover:border-ink-600 enabled:hover:bg-ink-700 disabled:cursor-default"
    >
      <FrameGlyph className={`w-4 h-4 shrink-0 text-sky-300 light:text-sky-700 ${item.streaming ? 'pulse-soft' : ''}`} />
      <span className="max-w-[16rem] truncate text-sm text-fg-secondary group-enabled:group-hover:text-fg">
        {board?.name ?? boardId}
      </span>
      <span className={`shrink-0 text-xs ${item.streaming ? 'text-fg-muted' : 'text-fg-faint'}`}>{status}</span>
    </button>
  )

  return (
    <div className="flex items-center pl-13 pr-4 py-1 select-none">
      {board ? <HoverCard content={<BoardCardContent boardId={boardId} />}>{chip}</HoverCard> : chip}
    </div>
  )
}

export default memo(DesignChip, (before, after) => sameItem(before.item, after.item))
