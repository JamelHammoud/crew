import { useEffect } from 'react'
import PanelToggle from '../components/PanelToggle'
import SidePanel from '../components/SidePanel'
import Spinner from '../components/Spinner'
import Toaster from '../components/Toaster'
import { TOP_BAR_H } from '../components/TopBar'
import { useCrew } from '../state/store'
import { threadIdInHash } from '../../../shared/threadViews'
import ThreadView from './ThreadView'

// One thread, standing in a window of its own. It is the same session as the
// window it came out of, so the thread is live here: it takes a message, it
// steers, and what an agent does in it reads here as it happens.
export default function ThreadWindow() {
  const threadId = threadIdInHash(window.location.hash)
  const connection = useCrew(s => s.connection)
  const thread = useCrew(s => (threadId ? s.threads[threadId] : undefined))

  // This window is reading that thread, and everything downstream asks the same
  // question of the same field: what a page an agent shows opens in, what the
  // panel holds, and what is already on the screen and so not worth a banner.
  useEffect(() => {
    if (threadId) useCrew.setState({ openThreadIds: [threadId], openThreadId: threadId })
  }, [threadId, connection])

  return (
    <div className="h-full flex relative">
      <div className="flex-1 min-w-0 relative">
        <div className="absolute top-0 inset-x-0 z-30 pointer-events-none">
          <div className="page-scrim absolute inset-x-0 top-0" />
          <div
            style={{ height: TOP_BAR_H }}
            className="app-drag relative pointer-events-auto flex items-center justify-end px-4"
          >
            <PanelToggle alwaysVisible />
          </div>
        </div>
        {threadId && thread ? (
          <ThreadView threadId={threadId} alone />
        ) : connection === 'booting' || connection === 'connecting' ? (
          <div className="h-full flex items-center justify-center">
            <Spinner size={20} />
          </div>
        ) : (
          <p className="h-full flex items-center justify-center px-8 text-base text-fg-muted text-center">
            This thread is not here any more.
          </p>
        )}
      </div>
      <SidePanel />
      <Toaster />
    </div>
  )
}
