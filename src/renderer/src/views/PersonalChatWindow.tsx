import { useEffect, useMemo, useState } from 'react'
import { ClockGlyph, PencilGlyph, PlusGlyph, SearchGlyph, TrashGlyph } from '../icons'
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
    if (active && !threads[active]) setActive(null)
  }, [active, threads])

  const open = (threadId: string) => {
    setActive(threadId)
    setHistoryOpen(false)
  }

  const fresh = () => {
    setActive(null)
    setHistoryOpen(false)
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
