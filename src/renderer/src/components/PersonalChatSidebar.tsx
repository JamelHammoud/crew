import { useMemo, useState } from 'react'
import { stripMention } from '../../../shared/llm'
import { ChatGlyph, CloseGlyph, PencilGlyph, PlusGlyph, SearchGlyph, TrashGlyph } from '../icons'
import { useCrew, type ThreadMeta } from '../state/store'
import AgentIcon from './AgentIcon'
import Tooltip from './Tooltip'
import { formatShortDay, formatTime } from './time'

export default function PersonalChatSidebar({
  active,
  onOpen,
  onNew,
  onDelete
}: {
  active: string | null
  onOpen: (threadId: string) => void
  onNew: () => void
  onDelete: (threadId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const connection = useCrew(s => s.connection)
  const events = useCrew(s => s.events)
  const threads = useCrew(s => s.threads)
  const renameThread = useCrew(s => s.renameThread)
  const activity = useMemo(() => {
    const latest: Record<string, number> = {}
    for (const event of events) {
      if (!('threadId' in event) || !event.threadId) continue
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
    const grouped: Array<{ label: string; chats: ThreadMeta[] }> = []
    for (const chat of history) {
      const label = formatShortDay(activity[chat.id] ?? chat.startedAt ?? 0)
      const current = grouped.at(-1)
      if (current?.label === label) current.chats.push(chat)
      else grouped.push({ label, chats: [chat] })
    }
    return grouped
  }, [activity, history])

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
    onDelete(threadId)
    setDeleting(null)
  }

  return (
    <aside data-personal-history className="w-[300px] shrink-0 bg-ink-850 border-r border-ink-700 flex flex-col">
      <header className="app-drag h-[70px] shrink-0 pl-4 pr-3 mac:pl-[92px] flex items-center gap-2">
        <h1 className="flex-1 text-lg font-bold text-fg">Chat</h1>
        <Tooltip label="New chat">
          <button
            onClick={() => {
              setQuery('')
              onNew()
            }}
            aria-label="New chat"
            className="app-no-drag w-9 h-9 rounded-full flex items-center justify-center text-fg-muted transition-[color,background-color,transform] duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
          >
            <PlusGlyph className="w-4 h-4" />
          </button>
        </Tooltip>
      </header>

      <div className="px-3 pb-4">
        <div className="h-10 rounded-full bg-ink-700 flex items-center gap-2 px-3 transition-shadow duration-150 focus-within:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.10)] light:focus-within:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]">
          <SearchGlyph className="w-4 h-4 shrink-0 text-fg/35" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg/35"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="w-7 h-7 rounded-full flex items-center justify-center text-fg/35 transition-colors hover:text-fg"
            >
              <CloseGlyph className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6">
        <div className="space-y-6">
          {groups.map(group => (
            <section key={group.label}>
              <h2 className="px-2 mb-1.5 text-xs font-semibold text-fg/45">{group.label}</h2>
              <div data-personal-history-group className="flex flex-col gap-1">
                {group.chats.map(one => {
                  const title = stripMention(one.title, one.agentLabel) || 'Untitled'
                  const at = activity[one.id] ?? one.startedAt ?? 0
                  return (
                    <div key={one.id} className="group/history relative">
                      {editing === one.id ? (
                        <div className="min-h-14 rounded-[15px] bg-fg/[0.06] px-3 py-2 flex items-center">
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
                          onClick={() => onOpen(one.id)}
                          aria-current={one.id === active ? 'page' : undefined}
                          className={`w-full min-h-14 px-3 pr-16 py-2 rounded-[15px] flex items-center gap-3 text-left transition-colors duration-150 ${
                            one.id === active ? 'bg-fg/[0.08]' : 'hover:bg-fg/[0.05]'
                          }`}
                        >
                          <span className="rounded-full">
                            <AgentIcon seed={one.agentId} size="md" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-sm font-medium truncate ${
                                one.id === active ? 'text-fg' : 'text-fg/80 group-hover/history:text-fg'
                              }`}
                            >
                              {title}
                            </span>
                            <span className="block mt-0.5 text-xs text-fg/40 truncate">{one.agentLabel}</span>
                          </span>
                        </button>
                      )}
                      {editing !== one.id && (
                        <>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg/35 transition-opacity duration-150 group-hover/history:opacity-0 group-focus-within/history:opacity-0">
                            {formatTime(at)}
                          </span>
                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center opacity-0 transition-opacity duration-150 group-hover/history:opacity-100 focus-within:opacity-100">
                            <button
                              onClick={() => {
                                setEditing(one.id)
                                setEditText(title)
                                setDeleting(null)
                              }}
                              aria-label={`Rename ${title}`}
                              className="w-7 h-8 rounded-[10px] text-fg/45 flex items-center justify-center transition-colors hover:text-fg focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-fg/30 outline-none"
                            >
                              <PencilGlyph className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => remove(one.id)}
                              aria-label={deleting === one.id ? `Confirm delete ${title}` : `Delete ${title}`}
                              className={`h-8 rounded-[10px] flex items-center justify-center transition-colors hover:text-danger focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-danger/40 outline-none ${
                                deleting === one.id ? 'px-1.5 text-xs text-danger' : 'w-7 text-fg/45'
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
            <span className="w-11 h-11 rounded-card bg-ink-800 flex items-center justify-center text-fg/45">
              {query ? <SearchGlyph className="w-5 h-5" /> : <ChatGlyph className="w-5 h-5" />}
            </span>
            <p className="text-sm text-fg-muted">{query ? 'No chats found.' : 'No chats yet.'}</p>
          </div>
        )}
      </div>
    </aside>
  )
}
