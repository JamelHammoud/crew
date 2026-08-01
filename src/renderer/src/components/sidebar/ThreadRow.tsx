import type { LiveThread } from '../../../../shared/threads'
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
        aria-current={open ? 'page' : undefined}
        className={`relative ml-8 h-8 w-[calc(100%-2rem)] rounded-lg px-2 flex items-center gap-2 text-left text-sm transition-colors duration-150 ${
          open
            ? 'bg-fg/[0.07] text-fg before:absolute before:left-0 before:top-1/2 before:h-3 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-fg/70'
            : 'text-fg/50 hover:bg-fg/[0.05] hover:text-fg/85'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{thread.title}</span>
        {thread.working && <span className="w-1.5 h-1.5 rounded-full bg-positive shrink-0 animate-pulse" />}
      </button>
      {menu}
    </>
  )
}
