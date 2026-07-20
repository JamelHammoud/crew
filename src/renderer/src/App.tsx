import { useState } from 'react'
import TopBar, { type Tab } from './components/TopBar'
import { useCrew } from './state/store'
import Chat from './views/Chat'
import Dashboard from './views/Dashboard'
import Docs from './views/Docs'
import Home from './views/Home'
import ThreadView from './views/ThreadView'

export default function App() {
  const connection = useCrew(s => s.connection)
  if (connection === 'home') return <Home />
  return <Session />
}

function Session() {
  const [tab, setTab] = useState<Tab>('chat')
  const openThreadId = useCrew(s => s.openThreadId)
  const closeThread = useCrew(s => s.closeThread)

  const switchTab = (next: Tab) => {
    if (next === 'chat') closeThread()
    setTab(next)
  }

  return (
    <div className="h-full relative">
      <main className="absolute inset-0">
        {tab === 'chat' && (openThreadId ? <ThreadView threadId={openThreadId} /> : <Chat />)}
        {tab === 'agents' && <Dashboard />}
        {tab === 'docs' && <Docs />}
      </main>
      <div className="absolute top-0 inset-x-0 z-40 pointer-events-none">
        <div className="pointer-events-auto bg-ink-900">
          <TopBar tab={tab} onTab={switchTab} />
        </div>
        <div className="h-10 bg-gradient-to-b from-ink-900 to-transparent" />
      </div>
    </div>
  )
}
