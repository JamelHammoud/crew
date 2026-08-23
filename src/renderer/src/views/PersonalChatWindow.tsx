import { useEffect, useState } from 'react'
import PersonalChatSidebar from '../components/PersonalChatSidebar'
import Toaster from '../components/Toaster'
import { useCrew } from '../state/store'
import Chat from './Chat'
import ThreadView from './ThreadView'

export default function PersonalChatWindow() {
  const [active, setActive] = useState<string | null>(null)
  const [freshKey, setFreshKey] = useState(0)
  const threads = useCrew(s => s.threads)
  const readThread = useCrew(s => s.readThread)
  const deleteThread = useCrew(s => s.deleteThread)
  const thread = active ? threads[active] : undefined

  useEffect(() => {
    if (active) readThread(active)
  }, [active, readThread])

  const fresh = () => {
    setActive(null)
    setFreshKey(key => key + 1)
  }

  return (
    <div className="h-full relative flex bg-ink-900">
      <PersonalChatSidebar
        active={active}
        onOpen={setActive}
        onNew={fresh}
        onDelete={threadId => {
          deleteThread(threadId)
          if (active === threadId) fresh()
        }}
      />
      <main data-personal-chat-content className="flex-1 min-w-0 relative">
        {thread ? (
          <ThreadView threadId={thread.id} alone personal />
        ) : (
          <Chat key={freshKey} personal onStart={setActive} />
        )}
      </main>
      <Toaster />
    </div>
  )
}
