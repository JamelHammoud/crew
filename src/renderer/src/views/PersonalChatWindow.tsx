import { useEffect, useMemo, useState } from 'react'
import { ChatGlyph, ClockGlyph, CloseGlyph, PencilGlyph, PlusGlyph, SearchGlyph, TrashGlyph } from '../icons'
import { stripMention } from '../../../shared/llm'
import Tooltip from '../components/Tooltip'
import Toaster from '../components/Toaster'
import { TOP_BAR_H } from '../components/TopBar'
import { formatShortDay, formatTime } from '../components/time'
import { useCrew } from '../state/store'
import Chat from './Chat'
import ThreadView from './ThreadView'

export default function PersonalChatWindow() {
  const [active, setActive] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const connection = useCrew(s => s.connection)
  const events = useCrew(s => s.events)
  const threads = useCrew(s => s.threads)
  const readThread = useCrew(s => s.readThread)
  const renameThread = useCrew(s => s.renameThread)
  const deleteThread = useCrew(s => s.deleteThread)
  const thread = active ? threads[active] : undefined
  const activity = useMemo(() => {
    const latest: Record<string, number> = {}
    for (const event of events) {
      if (!('threadId' in event)) continue
      latest[event.threadId] = Math.max(latest[event.threadId] ?? 0, event.ts)
    }
    return latest
  }, [events])
  const history = useMemo(() => {
    const searched = query.trim().toLowerCase()
    return Object.values(threads)
        .filter(one => !one.parentThreadId && !one.aside && !one.ghost)
        .filter(one => one.title.toLowerCase().includes(searched))
        .sort((a, b) => (activity[b.id] ?? b.startedAt ?? 0) - (activity[a.id] ?? a.startedAt ?? 0))
  }, [activity, query, threads])
  const groups = useMemo(() => {
    const grouped: Array<{ label: string; chats: typeof history }> = []
    for (const chat of history) {
      const label = formatShortDay(activity[chat.id] ?? chat.startedAt ?? 0)
      const current = grouped.at(-1)
      if (current?.label === label) current.chats.push(chat)
      else grouped.push({ label, chats: [chat] })
    }
    return grouped
  }, [activity, history])

  useEffect(() => {
    if (active) readThread(active)
  }, [active, readThread])

  useEffect(() => {
    if (!historyOpen) {
      setSearching(false)
      setQuery('')
      return
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHistoryOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historyOpen])

  const closeHistory = () => {
    setHistoryOpen(false)
    setEditing(null)
    setDeleting(null)
  }

  const closeSearch = () => {
    setSearching(false)
    setQuery('')
  }

  const open = (threadId: string) => {
    setActive(threadId)
    closeHistory()
  }

  const fresh = () => {
    setActive(null)
    closeHistory()
  }

  const beginRename = (threadId: string, title: string) => {
    setEditing(threadId)
    setEditText(title)
    setDeleting(null)
  }

  const saveRename = () => {
    if (editing && editText.trim()) renameThread(editing, editText)
    setEditing(null)
  }

  const remove = (threadId: string) => {
    if (deleting !== threadId) {
      setDeleting(threadId)
      setEditing(null)
      return
    }
    deleteThread(threadId)
    if (active === threadId) setActive(null)
    setDeleting(null)
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
        </div>
      </div>
      {thread ? <ThreadView threadId={thread.id} alone personal /> : <Chat personal onStart={setActive} />}
      {historyOpen && <div className="absolute inset-0 z-30" onClick={closeHistory} />}
      <div className="absolute inset-0 z-50 overflow-hidden pointer-events-none">
        <aside
          data-personal-history
          aria-hidden={!historyOpen}
          className={`app-no-drag pointer-events-auto absolute inset-y-0 right-0 w-[380px] bg-ink-900 border-l border-ink-700 shadow-2xl shadow-black/40 light:shadow-black/10 flex flex-col transition-transform duration-200 ${
            historyOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <header className="h-[70px] px-5 flex items-center shrink-0">
            {searching ? (
              <>
                <SearchGlyph className="w-4 h-4 shrink-0 text-fg-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Escape') {
                      event.stopPropagation()
                      closeSearch()
                    }
                  }}
                  placeholder="Search chats"
                  className="flex-1 min-w-0 mx-2.5 bg-transparent text-base text-fg placeholder:text-fg-faint outline-none"
                />
                <button
                  onClick={closeSearch}
                  aria-label="Close search"
                  className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
                >
                  <CloseGlyph className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <h2 className="flex-1 text-lg font-bold text-fg">Chats</h2>
                <button
                  onClick={() => setSearching(true)}
                  aria-label="Search chats"
                  className="w-9 h-9 mr-1 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
                >
                  <SearchGlyph className="w-4 h-4" />
                </button>
                <button
                  onClick={closeHistory}
                  aria-label="Close chats"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
                >
                  <CloseGlyph className="w-4 h-4" />
                </button>
              </>
            )}
          </header>
          <div className="relative flex-1 min-h-0">
            <div className="h-full overflow-y-auto px-4 pb-6">
              {!searching && (
                <button
                  onClick={fresh}
                  className="w-full h-11 mb-7 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:bg-fg/90 active:scale-[0.98]"
                >
                  <PlusGlyph className="w-4 h-4" />
                  New chat
                </button>
              )}
              <div className="space-y-6">
                {groups.map(group => (
                  <section key={group.label}>
                    <h3 className="px-2.5 mb-1.5 text-xs font-semibold text-fg/45">{group.label}</h3>
                    <div className="rounded-card bg-ink-800 p-1.5">
                      {group.chats.map(one => {
                        const title = stripMention(one.title, one.agentLabel) || 'Untitled'
                        const at = activity[one.id] ?? one.startedAt ?? 0
                        return (
                          <div key={one.id} className="group/history relative">
                            {one.id === active && (
                              <span className="absolute z-10 left-1.5 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-fg" />
                            )}
                            {editing === one.id ? (
                              <div className="min-h-14 rounded-[15px] bg-fg/[0.08] pl-4 pr-3 py-2 flex items-center">
                                <input
                                  autoFocus
                                  value={editText}
                                  onChange={event => setEditText(event.target.value)}
                                  onBlur={() => setEditing(null)}
                                  onKeyDown={event => {
                                    if (event.key === 'Enter') saveRename()
                                    if (event.key === 'Escape') setEditing(null)
                                  }}
                                  aria-label="Chat name"
                                  className="w-full bg-transparent text-sm font-medium text-fg outline-none"
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => open(one.id)}
                                data-active={one.id === active ? '' : undefined}
                                className="w-full min-h-14 pl-4 pr-20 py-2 rounded-[15px] text-left transition-colors duration-150 hover:bg-fg/[0.05] data-active:bg-fg/[0.08]"
                              >
                                <span
                                  className={`block text-sm font-medium truncate ${
                                    one.id === active ? 'text-fg' : 'text-fg/80 group-hover/history:text-fg'
                                  }`}
                                >
                                  {title}
                                </span>
                                <span className="block mt-0.5 text-xs text-fg/40 truncate">{one.agentLabel}</span>
                              </button>
                            )}
                            {editing !== one.id && (
                              <>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg/35 transition-opacity duration-150 group-hover/history:opacity-0 group-focus-within/history:opacity-0">
                                  {formatTime(at)}
                                </span>
                                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center rounded-xl bg-ink-700 p-0.5 opacity-0 transition-opacity duration-150 group-hover/history:opacity-100 focus-within:opacity-100">
                                  <button
                                    onClick={() => beginRename(one.id, title)}
                                    aria-label={`Rename ${title}`}
                                    className="w-8 h-8 rounded-[10px] text-fg/45 flex items-center justify-center hover:bg-fg/[0.08] hover:text-fg"
                                  >
                                    <PencilGlyph className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => remove(one.id)}
                                    aria-label={deleting === one.id ? `Confirm delete ${title}` : `Delete ${title}`}
                                    className={`h-8 rounded-[10px] flex items-center justify-center hover:bg-danger/10 hover:text-danger ${
                                      deleting === one.id ? 'px-2 text-xs text-danger' : 'w-8 text-fg/45'
                                    }`}
                                  >
                                    {deleting === one.id ? 'Delete' : <TrashGlyph className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
              {connection === 'online' && history.length === 0 && (
                <div className="mt-20 flex flex-col items-center gap-4 text-center">
                  <span className="w-12 h-12 rounded-card bg-ink-800 flex items-center justify-center text-fg/45">
                    {query ? <SearchGlyph className="w-5 h-5" /> : <ChatGlyph className="w-5 h-5" />}
                  </span>
                  <p className="text-sm text-fg-muted">{query ? 'No chats found.' : 'No chats yet.'}</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
      <Toaster />
    </div>
  )
}
