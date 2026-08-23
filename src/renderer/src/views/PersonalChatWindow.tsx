import { useEffect, useState, type CSSProperties } from 'react'
import PersonalChatSidebar from '../components/PersonalChatSidebar'
import Tooltip from '../components/Tooltip'
import Toaster from '../components/Toaster'
import { PanelLeftGlyph } from '../icons'
import { useCrew } from '../state/store'
import Chat from './Chat'
import ThreadView from './ThreadView'

export default function PersonalChatWindow() {
  const [active, setActive] = useState<string | null>(null)
  const [freshKey, setFreshKey] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
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
        onCollapse={() => setCollapsed(true)}
        collapsed={collapsed}
      />
      <main
        data-personal-chat-content
        style={{ '--page-rest': '56px' } as CSSProperties}
        className="flex-1 min-w-0 relative"
      >
        {collapsed && (
          <div className="app-drag absolute top-0 left-0 z-40 h-[70px] pl-4 mac:pl-[92px] flex items-center">
            <Tooltip label="Show chat list">
              <button
                onClick={() => setCollapsed(false)}
                aria-label="Show chat list"
                className="app-no-drag w-9 h-9 rounded-full flex items-center justify-center text-fg-muted transition-[color,background-color,transform] duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
              >
                <PanelLeftGlyph className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        )}
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
