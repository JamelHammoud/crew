import { useEffect, useState } from 'react'
import Spinner from './components/Spinner'
import TasksPanel from './components/TasksPanel'
import TopBar, { type Tab } from './components/TopBar'
import { useCrew } from './state/store'
import Chat from './views/Chat'
import Dashboard from './views/Dashboard'
import Docs from './views/Docs'
import Home from './views/Home'
import Studio from './views/Studio'
import ThreadView from './views/ThreadView'

export default function App() {
  const connection = useCrew(s => s.connection)
  if (connection === 'booting') return <Boot />
  if (connection === 'home') return <Home />
  return <Session />
}

function Boot() {
  return (
    <div className="relative h-full flex items-center justify-center">
      <div className="app-drag absolute top-0 inset-x-0 h-[70px]" />
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
  const activeStudioId = useCrew(s => s.activeStudioId)
  const closeStudio = useCrew(s => s.closeStudio)

  useEffect(() => {
    if (activeStudioId) setTab('studio')
  }, [activeStudioId])

  const switchTab = (next: Tab) => {
    if (next === 'chat') closeThread()
    if (tab === 'studio' && next !== 'studio') closeStudio()
    setTab(next)
  }

  const openFromTasks = (threadId: string) => {
    setTab('chat')
    openThread(threadId)
    setTasksOpen(false)
  }

  return (
    <div className="h-full relative">
      <main className="absolute inset-0">
        {tab === 'chat' && (openThreadId ? <ThreadView threadId={openThreadId} /> : <Chat />)}
        {tab === 'agents' && <Dashboard />}
        {tab === 'docs' && <Docs />}
        {tab === 'studio' && <Studio />}
      </main>
      <div className="absolute top-0 inset-x-0 z-40 pointer-events-none">
        <div className="pointer-events-auto bg-ink-900">
          <TopBar tab={tab} onTab={switchTab} tasksOpen={tasksOpen} onToggleTasks={() => setTasksOpen(v => !v)} />
        </div>
        <div className="h-10 bg-gradient-to-b from-ink-900 to-transparent" />
      </div>
      <TasksPanel open={tasksOpen} onClose={() => setTasksOpen(false)} onOpenThread={openFromTasks} />
    </div>
  )
}
