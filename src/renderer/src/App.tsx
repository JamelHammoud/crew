import { useState } from 'react'
import { useCrew } from './state/store'
import Chat from './views/Chat'
import Dashboard from './views/Dashboard'
import Docs from './views/Docs'
import Home from './views/Home'
import ThreadView from './views/ThreadView'

type Tab = 'chat' | 'agents' | 'docs'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'agents', label: 'Agents' },
  { id: 'docs', label: 'Docs' }
]

export default function App() {
  const connection = useCrew(s => s.connection)
  if (connection === 'home') return <Home />
  return <Session />
}

function Session() {
  const [tab, setTab] = useState<Tab>('chat')
  const joinLink = useCrew(s => s.joinLink)
  const connection = useCrew(s => s.connection)
  const leave = useCrew(s => s.leave)
  const openThreadId = useCrew(s => s.openThreadId)
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    if (!joinLink) return
    await navigator.clipboard.writeText(joinLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-6 px-5 h-14 border-b border-zinc-800 shrink-0">
        <span className="text-white font-semibold tracking-tight">crew</span>
        <nav className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-sm ${
                tab === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {connection === 'reconnecting' && <span className="text-xs text-zinc-400">Connection lost. Trying again…</span>}
          {joinLink && (
            <button
              onClick={copyLink}
              className="text-xs px-3 py-1.5 rounded-md border border-zinc-700 text-zinc-300 hover:border-zinc-500"
            >
              {copied ? 'Copied' : 'Copy invite link'}
            </button>
          )}
          <button onClick={leave} className="text-xs px-3 py-1.5 rounded-md text-zinc-400 hover:text-zinc-200">
            Leave
          </button>
        </div>
      </header>
      <main className="flex-1 min-h-0">
        {tab === 'chat' && (openThreadId ? <ThreadView threadId={openThreadId} /> : <Chat />)}
        {tab === 'agents' && <Dashboard />}
        {tab === 'docs' && <Docs />}
      </main>
    </div>
  )
}
