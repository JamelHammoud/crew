import { useEffect, useState, type CSSProperties } from 'react'
import PanelToggle from '../components/PanelToggle'
import PersonalChatSidebar from '../components/PersonalChatSidebar'
import SidePanel from '../components/SidePanel'
import Tooltip from '../components/Tooltip'
import Toaster from '../components/Toaster'
import { PanelLeftGlyph } from '../icons'
import { useCrew } from '../state/store'
import { useWindowName } from '../state/windowName'
import { threadName } from '../components/thread'
import useSidebarWindowGlass from '../components/useSidebarWindowGlass'
import { useFullScreen } from '../state/windowShape'
import Chat from './Chat'
import ThreadView from './ThreadView'

export default function PersonalChatWindow() {
  const [active, setActive] = useState<string | null>(null)
  const [freshKey, setFreshKey] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const glass = useSidebarWindowGlass()
  const full = useFullScreen()
  const connection = useCrew(s => s.connection)
  const threads = useCrew(s => s.threads)
  const readThread = useCrew(s => s.readThread)
  const deleteThread = useCrew(s => s.deleteThread)
  const thread = active ? threads[active] : undefined
  const agents = useCrew(s => s.agents)

  useWindowName(thread ? threadName(thread, agents) : '')

  useEffect(() => {
    if (active) readThread(active)
  }, [active, readThread])

  useEffect(() => {
    useCrew.setState({ openThreadIds: active ? [active] : [], openThreadId: active })
  }, [active, connection])

  const fresh = () => {
    setActive(null)
    setFreshKey(key => key + 1)
  }

  return (
    <div className={`h-full relative flex ${glass ? 'bg-transparent' : 'bg-ink-900'}`}>
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
        className="flex-1 min-w-0 relative bg-ink-900"
      >
        <div
          data-personal-chat-drag-region
          className="app-drag pointer-events-none absolute inset-x-0 top-0 z-30 h-[70px]"
        />
        {collapsed && (
          <div
            data-personal-chat-collapsed-header
            className={`app-drag absolute top-0 left-0 z-40 h-[70px] pl-4 flex items-center ${
              full ? '' : 'mac:pl-[92px]'
            }`}
          >
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
        <div
          data-personal-chat-panel-toggle
          className="app-drag absolute top-0 right-0 z-40 h-[70px] pr-3 flex items-center"
        >
          <PanelToggle />
        </div>
        {thread ? (
          <ThreadView threadId={thread.id} alone personal />
        ) : (
          <Chat key={freshKey} personal onStart={setActive} />
        )}
      </main>
      <SidePanel />
      <Toaster />
    </div>
  )
}
