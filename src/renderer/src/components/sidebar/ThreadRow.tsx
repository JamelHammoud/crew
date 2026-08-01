import type { LiveThread } from '../../../../shared/threads'
import Spinner from '../Spinner'
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
        className={`w-full rounded-xl pl-8 pr-2 py-1.5 flex items-center gap-2 text-left text-sm transition-colors duration-150 ${
          open ? 'bg-fg/[0.10] text-fg' : 'text-fg/70 hover:bg-fg/[0.06] hover:text-fg'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{thread.title}</span>
        {thread.working && <Spinner size={10} className="text-fg" />}
      </button>
      {menu}
    </>
  )
}
