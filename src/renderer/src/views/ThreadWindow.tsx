import SidePanel from '../components/SidePanel'
import Spinner from '../components/Spinner'
import Toaster from '../components/Toaster'
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

  return (
    <div className="h-full flex relative">
      <div className="flex-1 min-w-0 relative">
        {/* The window has no bar of its own, so this band is what it is dragged
            by and what the traffic lights stand in. The thread already clears
            the same room at the top of its own column. */}
        <div className="app-drag absolute top-0 inset-x-0 h-14 z-30" />
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
      <SidePanel visible />
      <Toaster />
    </div>
  )
}
