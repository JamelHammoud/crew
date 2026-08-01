import { memo } from 'react'
import { EmojiText } from '../Emoji'
import Spinner from '../Spinner'
import { useThreadMenu } from '../threadMenu'
import { sameThreadRow, type ThreadRowProps } from './placeItems'

function ThreadRow({ thread, open, here, placeKey, onOpen, onOpenToRight }: ThreadRowProps) {
  const { onContextMenu, menu } = useThreadMenu({
    threadId: thread.id,
    here,
    placeKey,
    status: here,
    onOpen: () => onOpenToRight(thread.id)
  })

  return (
    <>
      <button
        onClick={() => onOpen(thread.id)}
        onContextMenu={onContextMenu}
        className={`w-full rounded-xl pl-8 pr-2 py-1.5 flex items-center gap-2 text-left text-sm transition-colors duration-150 ${
          open ? 'bg-fg/[0.10] text-fg' : 'text-fg/70 hover:bg-fg/[0.06] hover:text-fg'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">
          {thread.title}
        </span>
        {thread.working && <Spinner size={10} className="text-fg" />}
      </button>
      {menu}
    </>
  )
}

export default memo(ThreadRow, sameThreadRow)
