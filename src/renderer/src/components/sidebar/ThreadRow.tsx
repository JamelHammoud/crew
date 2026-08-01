import type { LiveThread } from '../../../../shared/threads'
import { useThreadMenu } from '../threadMenu'

export default function ThreadRow({
  thread,
  open,
  here,
  placeKey,
  onOpen
}: {
  thread: LiveThread
  open: boolean
  here: boolean
  placeKey: string
  onOpen: () => void
}) {
  const { onContextMenu, menu } = useThreadMenu({ threadId: thread.id, here, placeKey, onOpen })

  return (
    <>
      <button
        onClick={onOpen}
        onContextMenu={onContextMenu}
        className={`w-full rounded-xl pl-8 pr-2 py-1.5 flex items-center gap-2 text-left text-sm transition-colors duration-150 ${
          open ? 'bg-ink-700 text-fg' : 'text-fg-secondary hover:bg-ink-700/60 hover:text-fg'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{thread.title}</span>
        {thread.working && <span className="w-1.5 h-1.5 rounded-full bg-positive shrink-0 animate-pulse" />}
      </button>
      {menu}
    </>
  )
}
