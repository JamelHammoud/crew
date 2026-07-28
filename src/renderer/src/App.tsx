import { useCallback, useEffect, useState } from 'react'
import HuddlePanel from './components/huddle/HuddlePanel'
import PlanPanel from './components/PlanPanel'
import SidePanel from './components/SidePanel'
import TasksPanel from './components/TasksPanel'
import TopBar, { type Tab } from './components/TopBar'
import { lazy, Suspense } from 'react'
import { reviewCount } from './state/alerts'
import { useCrew } from './state/store'
import Boot from './views/Boot'
import Chat from './views/Chat'
import Dashboard from './views/Dashboard'
import Docs from './views/Docs'
import Home from './views/Home'
import ThreadView from './views/ThreadView'

const Design = lazy(() => import('./views/Design'))

export default function App() {
  const connection = useCrew(s => s.connection)
  const waiting = useCrew(reviewCount)
  // Only ever the once, on the way in. Leaving a session goes back to the list
  // rather than back to the mark.
  const [booted, setBooted] = useState(false)
  const done = useCallback(() => setBooted(true), [])

  useEffect(() => {
    void window.crew?.setBadge?.(waiting)
  }, [waiting])

  if (!booted) return <Boot ready={connection !== 'booting'} onDone={done} />
  if (connection === 'home') return <Home />
  return <Session />
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
  const [tasksOpen, setTasksOpen] = useState(false)
  const openThreadId = useCrew(s => s.openThreadId)
  const closeThread = useCrew(s => s.closeThread)
  const openThread = useCrew(s => s.openThread)
  const docsTarget = useCrew(s => s.docsTarget)
  const designTarget = useCrew(s => s.designTarget)

  useEffect(() => {
    if (docsTarget) setTab('docs')
  }, [docsTarget])

  useEffect(() => {
    if (designTarget) setTab('design')
  }, [designTarget])

  useEffect(
    () =>
      window.crew?.onNotificationOpen?.(threadId => {
        setTab('chat')
        openThread(threadId)
      }),
    [openThread]
  )

  const switchTab = (next: Tab) => {
    if (next === 'chat') closeThread()
    setTab(next)
  }

  const openFromTasks = (threadId: string) => {
    setTab('chat')
    openThread(threadId)
    setTasksOpen(false)
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0 relative">
        <main className="absolute inset-0">
          {tab === 'chat' && (openThreadId ? <ThreadView threadId={openThreadId} /> : <Chat />)}
          {tab === 'agents' && <Dashboard />}
          {tab === 'docs' && <Docs />}
          {tab === 'design' && (
            <Suspense fallback={<Loading />}>
              <Design />
            </Suspense>
          )}
        </main>
        <div className="absolute top-0 inset-x-0 z-40 pointer-events-none">
          <div className="top-bar-container pointer-events-auto bg-ink-900">
            <TopBar tab={tab} onTab={switchTab} tasksOpen={tasksOpen} onToggleTasks={() => setTasksOpen(v => !v)} />
          </div>
          {tab !== 'design' && <div className="h-10 bg-gradient-to-b from-ink-900 to-transparent" />}
        </div>
        <TasksPanel open={tasksOpen} onClose={() => setTasksOpen(false)} onOpenThread={openFromTasks} />
      </div>
      {tab === 'chat' && openThreadId && <PlanPanel threadId={openThreadId} />}
      <SidePanel visible={tab === 'chat'} />
      <HuddlePanel />
    </div>
  )
}
