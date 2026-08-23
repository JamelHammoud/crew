import { useEffect, useMemo, useState } from 'react'
import { ClockGlyph, CloseGlyph, PencilGlyph, PlusGlyph, SearchGlyph, TrashGlyph } from '../icons'
import { stripMention } from '../../../shared/llm'
import Tooltip from '../components/Tooltip'
import Toaster from '../components/Toaster'
import { TOP_BAR_H } from '../components/TopBar'
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
  const threads = useCrew(s => s.threads)
  const readThread = useCrew(s => s.readThread)
  const renameThread = useCrew(s => s.renameThread)
  const deleteThread = useCrew(s => s.deleteThread)
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
                  onClick={fresh}
                  aria-label="New chat"
                  className="w-9 h-9 mr-1 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
                >
                  <PlusGlyph className="w-4 h-4" />
                </button>
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
            <div className="h-full overflow-y-auto px-3 pb-6">
              {history.map(one => {
                const title = stripMention(one.title, one.agentLabel) || 'Untitled'
                return (
                  <div key={one.id} className="group/history relative">
                    {editing === one.id ? (
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
                        className="w-full h-10 rounded-xl bg-fg/[0.08] px-3 pr-20 text-sm text-fg outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => open(one.id)}
                        data-active={one.id === active ? '' : undefined}
                        className="w-full px-3 pr-20 py-2.5 rounded-xl text-left text-sm text-fg/70 truncate transition-colors hover:bg-fg/[0.06] hover:text-fg data-active:bg-fg/[0.08] data-active:text-fg"
                      >
                        {title}
                      </button>
                    )}
                    {editing !== one.id && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover/history:opacity-100 focus-within:opacity-100">
                        <button
                          onClick={() => beginRename(one.id, title)}
                          aria-label={`Rename ${title}`}
                          className="w-8 h-8 rounded-lg text-fg/45 flex items-center justify-center hover:bg-fg/[0.08] hover:text-fg"
                        >
                          <PencilGlyph className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => remove(one.id)}
                          aria-label={deleting === one.id ? `Confirm delete ${title}` : `Delete ${title}`}
                          className={`h-8 rounded-lg flex items-center justify-center hover:bg-danger/10 hover:text-danger ${
                            deleting === one.id ? 'px-2 text-xs text-danger' : 'w-8 text-fg/45'
                          }`}
                        >
                          {deleting === one.id ? 'Delete' : <TrashGlyph className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {connection === 'online' && history.length === 0 && (
                <p className="px-6 mt-16 text-base text-fg-muted text-center">
                  {query ? 'No chats found.' : 'No chats yet.'}
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
      <Toaster />
    </div>
  )
}
