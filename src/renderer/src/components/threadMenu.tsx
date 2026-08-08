import { useState, type MouseEvent, type ReactNode } from 'react'
import { threadMenuActions, type ThreadOpenAction } from '../../../shared/threadViews'
import {
  ArchiveGlyph,
  CheckGlyph,
  CopyGlyph,
  CloseGlyph,
  ColumnsGlyph,
  PopOutGlyph,
  UndoGlyph
} from '../icons'
import { useCrew } from '../state/store'
import { toast } from '../state/toast'
import { MenuDivider, MenuItem, Popover } from './Popover'

const LABEL: Record<ThreadOpenAction, string> = {
  open: 'Open',
  beside: 'Open to right',
  window: 'Open in window',
  close: 'Close'
}

const OWN_MENU = 'a, img, input, textarea, [contenteditable="true"]'

export function ownsMenu(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OWN_MENU) !== null
}

const MARK: Record<ThreadOpenAction, ReactNode> = {
  open: <ColumnsGlyph />,
  beside: <ColumnsGlyph />,
  window: <PopOutGlyph />,
  close: <CloseGlyph />
}

export function ThreadOpenItems({
  threadId,
  here = true,
  placeKey,
  onOpen,
  onDone
}: {
  threadId: string
  here?: boolean
  placeKey?: string
  onOpen: () => void
  onDone: () => void
}) {
  const open = useCrew(s => s.openThreadIds)
  const closeThread = useCrew(s => s.closeThread)

  const take = (action: ThreadOpenAction) => {
    onDone()
    if (action === 'close') return closeThread(threadId)
    if (action !== 'window') return onOpen()
    void window.crew?.popOutThread?.(threadId, placeKey)
    if (here && open.includes(threadId)) closeThread(threadId)
  }

  return (
    <>
      {threadMenuActions(open, threadId, here).map(action => (
        <MenuItem key={action} icon={MARK[action]} label={LABEL[action]} onClick={() => take(action)} />
      ))}
    </>
  )
}

export function ThreadStatusItems({ threadId, onDone }: { threadId: string; onDone: () => void }) {
  const status = useCrew(s => s.threads[threadId]?.status)
  const setThreadStatus = useCrew(s => s.setThreadStatus)

  const set = (to: 'open' | 'done' | 'archived') => {
    onDone()
    setThreadStatus(threadId, to)
  }

  return (
    <>
      {status === 'done' ? (
        <MenuItem icon={<UndoGlyph />} label="Reopen" onClick={() => set('open')} />
      ) : (
        <MenuItem icon={<CheckGlyph />} label="Mark done" onClick={() => set('done')} />
      )}
      <MenuItem icon={<ArchiveGlyph />} label="Archive thread" onClick={() => set('archived')} />
    </>
  )
}

export function ThreadIdItem({ threadId, onDone }: { threadId: string; onDone: () => void }) {
  return (
    <MenuItem
      icon={<CopyGlyph />}
      label="Copy thread ID"
      onClick={() => {
        onDone()
        void navigator.clipboard.writeText(threadId).then(() => {
          toast.done('Thread ID copied', { key: 'thread-id' })
        })
      }}
    />
  )
}

export function useThreadMenu({
  status,
  ...props
}: {
  threadId: string
  here?: boolean
  placeKey?: string
  // Where a thread is left is the crew's own, and this window's socket only
  // reaches the crew it is in, so a thread in another project is opened from
  // here and finished there.
  status?: boolean
  onOpen: () => void
}): { onContextMenu: (event: MouseEvent) => void; menu: ReactNode } {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  return {
    onContextMenu: event => {
      if (selecting()) return
      event.preventDefault()
      setAt({ x: event.clientX, y: event.clientY })
    },
    menu: (
      <Popover open={at !== null} onClose={() => setAt(null)} at={at ?? undefined} className="min-w-52">
        <ThreadOpenItems {...props} onDone={() => setAt(null)} />
        {status && <MenuDivider />}
        {status && <ThreadStatusItems threadId={props.threadId} onDone={() => setAt(null)} />}
        <MenuDivider />
        <ThreadIdItem threadId={props.threadId} onDone={() => setAt(null)} />
      </Popover>
    )
  }
}
