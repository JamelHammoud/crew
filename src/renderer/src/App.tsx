import { useCallback, useEffect, useState } from 'react'
import HuddlePanel from './components/huddle/HuddlePanel'
import Settings from './components/settings/Settings'
import Sidebar from './components/Sidebar'
import SidePanel from './components/SidePanel'
import ThreadColumns from './components/ThreadColumns'
import Spinner from './components/Spinner'
import TasksPanel from './components/TasksPanel'
import Toaster from './components/Toaster'
import ToolBuilder from './components/ToolBuilder'
import TopBar from './components/TopBar'
import { tabLabel, type Tab } from './components/navTabs'
import VoiceScreen from './components/voice/VoiceScreen'
import WindowCorner from './components/WindowCorner'
import { lazy, Suspense } from 'react'
import { reviewCount } from './state/alerts'
import { onMac } from './state/platform'
import { useMail } from './state/mail'
import { PIN_MS, SIDEBAR_W, useSidebar } from './state/sidebar'
import { useCrew } from './state/store'
import { useTasks } from './state/tasks'
import { toast } from './state/toast'
import { watchUpdates } from './state/update'
import { useWindowName } from './state/windowName'
import { threadName } from './components/thread'
import { bootSeen, rememberBoot } from './components/boot/seen'
import Boot from './views/Boot'
import Chat from './views/Chat'
import Docs from './views/Docs'
import Home from './views/Home'

const Design = lazy(() => import('./views/Design'))
const Mail = lazy(() => import('./views/Mail'))
const Plugins = lazy(() => import('./views/Plugins'))
const Scheduled = lazy(() => import('./views/Scheduled'))

export default function App() {
  const connection = useCrew(s => s.connection)
  const waiting = useCrew(reviewCount)
  // Only ever the once, on the way in. Leaving a session goes back to the list
  // rather than back to the mark, and in dev a reload lands straight in the app
  // rather than flying in again.
  const [booted, setBooted] = useState(bootSeen)
  const done = useCallback(() => {
    rememberBoot()
    setBooted(true)
  }, [])

  useEffect(() => {
    void window.crew?.setBadge?.(waiting)
  }, [waiting])

  if (!booted) return <Boot ready={connection !== 'booting'} onDone={done} />
  return (
    <>
      {connection === 'home' ? <Home /> : <Session />}
      <Toaster />
    </>
  )
}

function Loading() {
  return (
    <div className="h-full flex items-center justify-center">
      <Spinner size={20} />
    </div>
  )
}

function Session() {
  const [tab, setTab] = useState<Tab>('chat')
  const [chatFocus, setChatFocus] = useState(0)
  const closeTasks = useTasks(s => s.close)
  const pinned = useSidebar(s => s.pinned)
  const peeking = useSidebar(s => s.peeking)
  const peek = useSidebar(s => s.peek)
  const openThreadIds = useCrew(s => s.openThreadIds)
  const closeThreads = useCrew(s => s.closeThreads)
  const openThread = useCrew(s => s.openThread)
  const openThreadAlone = useCrew(s => s.openThreadAlone)
  const openAlertThread = useCrew(s => s.openAlertThread)
  const docsTarget = useCrew(s => s.docsTarget)
  const designTarget = useCrew(s => s.designTarget)
  const agents = useCrew(s => s.agents)
  const focused = useCrew(s => (s.openThreadId ? s.threads[s.openThreadId] : undefined))

  useWindowName((tab === 'chat' && focused ? threadName(focused, agents) : '') || tabLabel(tab))

  useEffect(() => {
    if (docsTarget) setTab('docs')
  }, [docsTarget])

  useEffect(() => {
    if (designTarget) setTab('design')
  }, [designTarget])

  // A thread lives in the chat, so opening one from anywhere goes there: a
  // banner, a toast, a call, a task.
  useEffect(() => {
    if (openThreadIds.length > 0) setTab('chat')
  }, [openThreadIds])

  useEffect(() => {
    const root = document.getElementById('root')
    root?.classList.toggle('railed', pinned && onMac())
    return () => root?.classList.remove('railed')
  }, [pinned])

  useEffect(
    () => window.crew?.onNotificationOpen?.((threadId, place) => openAlertThread(threadId, place)),
    [openAlertThread]
  )

  useEffect(
    () =>
      window.mail?.onNotificationOpen?.(notification => {
        setTab('mail')
        void useMail.getState().showThread(notification.accountId, notification.threadId)
      }),
    []
  )

  useEffect(
    () =>
      window.crew?.onChatOpen?.(() => {
        closeThreads()
        setTab('chat')
        setChatFocus(current => current + 1)
      }),
    [closeThreads]
  )

  useEffect(() => watchUpdates(), [])

  useEffect(() => window.crew?.onCrewTrouble?.(message => toast.fail(message, { key: 'crew-sync' })), [])

  const switchTab = (next: Tab) => {
    if (next === 'chat') closeThreads()
    setTab(next)
  }

  const openFromTasks = (threadId: string) => {
    setTab('chat')
    openThreadAlone(threadId)
    closeTasks()
  }

  const openFromTasksBeside = (threadId: string) => {
    setTab('chat')
    openThread(threadId)
    closeTasks()
  }

  return (
    <div className="h-full flex relative">
      <div
        className="shrink-0 overflow-hidden transition-[width]"
        style={{ width: pinned ? SIDEBAR_W : 0, transitionDuration: `${PIN_MS}ms` }}
      >
        <div className="h-full" style={{ width: SIDEBAR_W }}>
          <Sidebar tab={tab} onTab={switchTab} />
        </div>
      </div>
      <div className="flex-1 min-w-0 relative isolate bg-ink-900">
        <main className="absolute inset-0">
          {tab === 'chat' &&
            (openThreadIds.length > 0 ? <ThreadColumns ids={openThreadIds} /> : <Chat focusRequest={chatFocus} />)}
          {tab === 'docs' && <Docs />}
          {tab === 'design' && (
            <Suspense fallback={<Loading />}>
              <Design />
            </Suspense>
          )}
          {tab === 'plugins' && (
            <Suspense fallback={<Loading />}>
              <Plugins />
            </Suspense>
          )}
          {tab === 'mail' && (
            <Suspense fallback={<Loading />}>
              <Mail />
            </Suspense>
          )}
          {tab === 'scheduled' && (
            <Suspense fallback={<Loading />}>
              <Scheduled />
            </Suspense>
          )}
        </main>
        <div className="absolute top-0 inset-x-0 z-40 pointer-events-none">
          {tab !== 'design' && <div className="page-scrim absolute inset-x-0 top-0" />}
          <div className="top-bar-container relative pointer-events-auto">
            <TopBar />
          </div>
        </div>
        <TasksPanel onOpenThread={openFromTasks} onOpenThreadBeside={openFromTasksBeside} />
      </div>
      <SidePanel />
      {(!pinned || peeking) && (
        <div
          onMouseEnter={() => peek(true)}
          onMouseLeave={() => peek(false)}
          data-open={peeking || undefined}
          style={{ width: SIDEBAR_W }}
          className="rail absolute inset-y-0 left-0 z-50"
        >
          <Sidebar overlay strong={tab === 'design'} tab={tab} onTab={switchTab} />
        </div>
      )}
      <WindowCorner />
      <HuddlePanel />
      <VoiceScreen />
      <Settings />
      <ToolBuilder />
    </div>
  )
}
