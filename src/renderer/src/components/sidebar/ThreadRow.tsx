import type { LiveThread } from '../../../../shared/threads'
import { ChatGlyph } from '../../icons'
import { useThreadMenu } from '../threadMenu'

export default function ThreadRow({
  thread,
  open,
  here,
  placeKey,
  onOpen,
  onOpenToRight
}: {
  thread: LiveThread
  open: boolean
  here: boolean
  placeKey: string
  onOpen: () => void
  onOpenToRight: () => void
}) {
  const { onContextMenu, menu } = useThreadMenu({
    threadId: thread.id,
    here,
    placeKey,
    onOpen: onOpenToRight
  })

  return (
    <>
      <button
        onClick={onOpen}
        onContextMenu={onContextMenu}
        className={`w-full h-8 rounded-xl px-2 flex items-center gap-2 text-left text-sm transition-colors duration-150 ${
          open
            ? 'bg-fg/[0.09] text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.025)]'
            : 'text-fg/55 hover:bg-fg/[0.055] hover:text-fg'
        }`}
      >
        <span className={`w-5 h-5 shrink-0 grid place-items-center ${open ? 'text-fg/65' : 'text-fg/30'}`}>
          <ChatGlyph className="w-3.5 h-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate">{thread.title}</span>
        {thread.working && <span className="w-1.5 h-1.5 rounded-full bg-positive shrink-0 animate-pulse" />}
      </button>
      {menu}
    </>
  )
}
