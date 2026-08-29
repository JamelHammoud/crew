import { memo } from 'react'
import { EmojiText } from '../Emoji'
import HoverCard from '../HoverCard'
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
      <HoverCard
        width={360}
        delay={2000}
        side="right"
        className="!block min-w-0 w-full"
        content={
          <div className="max-h-[300px] overflow-y-auto overscroll-contain select-text">
            <div className="mb-1 truncate text-sm font-semibold text-fg/70">{thread.preview.author}</div>
            <div className="whitespace-pre-wrap break-words text-sm leading-[1.6] text-fg/70">
              <EmojiText text={thread.preview.text} quiet />
            </div>
          </div>
        }
      >
        <button
          onClick={() => onOpen(thread.id)}
          onContextMenu={onContextMenu}
          className={`w-full rounded-xl pl-8 pr-2 py-1.5 flex items-center gap-2 text-left text-sm transition-colors duration-150 ${
            open ? 'bg-fg/[0.10] text-fg' : 'text-fg/70 hover:bg-fg/[0.06] hover:text-fg'
          }`}
        >
          <span className="min-w-0 flex-1 truncate">
            <EmojiText text={thread.title} />
          </span>
          {thread.working && <Spinner size={10} className="text-fg" />}
        </button>
      </HoverCard>
      {menu}
    </>
  )
}

export default memo(ThreadRow, sameThreadRow)
