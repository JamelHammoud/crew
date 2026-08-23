import { useEffect, useMemo, useState } from 'react'
import { ClockGlyph, PlusGlyph, SearchGlyph } from '../icons'
import { stripMention } from '../../../shared/llm'
import { Popover } from '../components/Popover'
import Tooltip from '../components/Tooltip'
import Toaster from '../components/Toaster'
import { TOP_BAR_H } from '../components/TopBar'
import { useCrew } from '../state/store'
import Chat from './Chat'
import ThreadView from './ThreadView'

export default function PersonalChatWindow() {
  const [active, setActive] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [query, setQuery] = useState('')
  const connection = useCrew(s => s.connection)
  const threads = useCrew(s => s.threads)
  const readThread = useCrew(s => s.readThread)
  const thread = active ? threads[active] : undefined
  const history = useMemo(
    () =>
      Object.values(threads)
        .filter(one => !one.parentThreadId && !one.aside && !one.ghost)
        .filter(one => one.title.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0)),
    [query, threads]
  )

  useEffect(() => {
    if (active) readThread(active)
  }, [active, readThread])

  const open = (threadId: string) => {
    setActive(threadId)
    setHistoryOpen(false)
  }

  const fresh = () => {
    setActive(null)
    setHistoryOpen(false)
  }

  return (
    <div className="h-full relative bg-ink-900">
      <div className="absolute top-0 inset-x-0 z-40 pointer-events-none">
        <div className="page-scrim absolute inset-x-0 top-0" />
        <div
          style={{ height: TOP_BAR_H }}
          className="app-drag relative pointer-events-auto flex items-center justify-end px-4"
        >
          <Tooltip label="Chat history" disabled={historyOpen}>
            <button
              onClick={() => setHistoryOpen(open => !open)}
              aria-label="Chat history"
              className="app-no-drag w-10 h-10 rounded-full text-fg/70 flex items-center justify-center transition-[color,background-color,transform] hover:bg-fg/[0.08] hover:text-fg active:scale-95"
            >
              <ClockGlyph className="w-5 h-5" />
            </button>
          </Tooltip>
          <Popover open={historyOpen} onClose={() => setHistoryOpen(false)} className="w-[320px]">
            <div className="px-2 pt-1.5 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-fg">Chats</h2>
              <button
                onClick={fresh}
                aria-label="New chat"
                className="w-8 h-8 rounded-full text-fg/70 flex items-center justify-center transition-[color,background-color,transform] hover:bg-fg/[0.08] hover:text-fg active:scale-95"
              >
                <PlusGlyph className="w-4 h-4" />
              </button>
            </div>
            <div className="relative mx-1 mb-1.5">
              <SearchGlyph className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/40 pointer-events-none" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search chats"
                className="w-full h-9 rounded-full bg-fg/[0.06] pl-9 pr-3 text-sm text-fg placeholder:text-fg/40 outline-none focus:bg-fg/[0.08]"
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {history.map(one => (
                <button
                  key={one.id}
                  onClick={() => open(one.id)}
                  data-active={one.id === active ? '' : undefined}
                  className="w-full px-3 py-2.5 rounded-xl text-left text-sm text-fg/70 truncate transition-colors hover:bg-fg/[0.06] hover:text-fg data-active:bg-fg/[0.08] data-active:text-fg"
                >
                  {stripMention(one.title, one.agentLabel) || 'Untitled'}
                </button>
              ))}
              {connection === 'online' && history.length === 0 && (
                <p className="px-3 py-8 text-sm text-fg/45 text-center">{query ? 'No chats found.' : 'No chats yet.'}</p>
              )}
            </div>
          </Popover>
        </div>
      </div>
      {thread ? <ThreadView threadId={thread.id} alone personal /> : <Chat personal onStart={setActive} />}
      <Toaster />
    </div>
  )
}
