import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Todo } from '../../../shared/events'
import { mentionsIn, relabelMentions, type PooledAgent } from '../../../shared/llm'
import {
  CheckGlyph,
  ChevronDownGlyph,
  ChevronRightGlyph,
  CloseGlyph,
  PlusGlyph,
  SearchGlyph,
  TrashGlyph,
  UnarchiveGlyph,
  UndoGlyph
} from '../icons'
import { useCrew, type ThreadMeta } from '../state/store'
import { AgentName } from './Mention'
import { AgentRow, MentionMenu, useMentionAutocomplete } from './MentionAutocomplete'
import ScrollFade from './ScrollFade'
import { useAutoResize } from './useAutoResize'
import useScrollEdges from './useScrollEdges'
import { Popover } from './Popover'
import { StateIcon } from './ThreadCard'
import {
  describeStep,
  endPreview,
  lastEnd,
  stripMention,
  threadState,
  threadWorking,
  type ThreadState
} from './thread'
import { formatFullTime, formatShortDay } from './time'
import Tooltip from './Tooltip'

interface Row {
  thread: ThreadMeta
  state: ThreadState
  detail: string
}

type DoneEntry = { ts: number; row: Row; todo?: never } | { ts: number; todo: Todo; row?: never }

interface RowAction {
  icon: ReactNode
  label: string
  status: ThreadMeta['status']
}

// The first @mention in the text becomes the assignment and leaves the text;
// a todo that is nothing but a mention keeps it so the text stays non-empty.
function parseTodoInput(text: string, agents: PooledAgent[]): { text: string; agentId?: string } {
  const agentId = mentionsIn(text, agents)[0]
  const label = agents.find(a => a.id === agentId)?.label
  if (!agentId || !label) return { text: text.trim() }
  const cleaned = stripMention(text, label)
  return cleaned ? { text: cleaned, agentId } : { text: text.trim(), agentId }
}

// Not a composer: an in-place list row that happens to be editable. It looks
// exactly like a todo row (circle, bare text), commits on Enter or blur, and
// in add-mode stays open so several tasks can be typed in a run.
function TodoEditor({
  initial = '',
  keepOpen = false,
  onCommit,
  onDone
}: {
  initial?: string
  keepOpen?: boolean
  onCommit: (raw: string) => void
  onDone: () => void
}) {
  const [value, setValue] = useState(initial)
  const inputRef = useAutoResize(value)
  const wrapRef = useRef<HTMLDivElement>(null)
  const mention = useMentionAutocomplete(value, setValue, inputRef, false)

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed) onCommit(trimmed)
    if (keepOpen && trimmed) {
      setValue('')
      return
    }
    onDone()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // The panel itself closes on Escape; one meant for the editor stops here.
      e.stopPropagation()
      if (mention.onKeyDown(e)) return
      onDone()
      return
    }
    if (mention.onKeyDown(e)) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commit()
    }
  }

  // Focus moving inside the row (the mention menu) is not leaving; anywhere
  // else commits what's typed rather than losing it.
  const onBlur = (e: React.FocusEvent) => {
    if (wrapRef.current?.contains(e.relatedTarget as Node)) return
    const trimmed = value.trim()
    if (trimmed) onCommit(trimmed)
    onDone()
  }

  return (
    <div ref={wrapRef} className="relative px-3 py-2.5 flex items-start gap-3">
      <span className="h-[22px] shrink-0 flex items-center">
        <span className="w-4 h-4 rounded-full border-[1.5px] border-fg-faint" />
      </span>
      <textarea
        ref={inputRef}
        value={value}
        onChange={e => mention.onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        rows={1}
        autoFocus
        placeholder="Type the task, @ to assign an agent"
        className="flex-1 min-w-0 bg-transparent text-base text-fg placeholder:text-fg-faint outline-none resize-none p-0"
      />
      <MentionMenu
        matches={mention.matches}
        activeIndex={mention.activeIndex}
        onPick={mention.pick}
        onHover={mention.setActive}
        side="bottom"
      />
    </div>
  )
}

export default function TasksPanel({
  open,
  onClose,
  onOpenThread
}: {
  open: boolean
  onClose: () => void
  onOpenThread: (threadId: string) => void
}) {
  const events = useCrew(s => s.events)
  const threads = useCrew(s => s.threads)
  const threadPrompts = useCrew(s => s.threadPrompts)
  const queues = useCrew(s => s.queues)
  const steps = useCrew(s => s.steps)
  const agents = useCrew(s => s.agents)
  const todos = useCrew(s => s.todos)
  const setThreadStatus = useCrew(s => s.setThreadStatus)
  const addTodo = useCrew(s => s.addTodo)
  const editTodo = useCrew(s => s.editTodo)
  const removeTodo = useCrew(s => s.removeTodo)
  const checkTodo = useCrew(s => s.checkTodo)
  const doTodo = useCrew(s => s.doTodo)
  const [showDone, setShowDone] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [picker, setPicker] = useState<{ todoId: string; at: { x: number; y: number } } | null>(null)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const { edges } = useScrollEdges(scrollRef)

  const closeSearch = () => {
    setSearching(false)
    setQuery('')
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setSearching(false)
      setQuery('')
    }
  }, [open])

  // Every thread the session knows about, not the ones whose start event is
  // still in the log: the log is trimmed as it grows, and reading the list off
  // it dropped older threads from the panel while they still counted as work.
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = []
    for (const thread of Object.values(threads)) {
      const promptId = threadPrompts[thread.id]
      const working = threadWorking(thread.id, threadPrompts, queues)
      const detail = promptId
        ? describeStep((steps[promptId] ?? []).at(-1))
        : endPreview(lastEnd(thread.id, events))
      list.push({ thread, state: threadState(thread, events, working), detail })
    }
    return list.reverse()
  }, [events, threads, threadPrompts, queues, steps])

  // When a thread last spoke: its start counts as the first message, then any
  // chat message or agent activity in it moves it up, like a chat history.
  const lastMessageAt = useMemo(() => {
    const at: Record<string, number> = {}
    for (const e of events) {
      if (e.kind === 'thread.started') at[e.threadId] = e.ts
      if (
        (e.kind === 'message' || e.kind === 'agent.start' || e.kind === 'agent.step' || e.kind === 'agent.end') &&
        e.threadId
      )
        at[e.threadId] = e.ts
    }
    return at
  }, [events])

  // A todo carries when it was checked, so this only covers one checked by a
  // host still running the code that did not write it down.
  const checkedAt = useMemo(() => {
    const at: Record<string, number> = {}
    for (const e of events) {
      if (e.kind === 'todo.checked' && e.checked) at[e.todoId] = e.ts
    }
    return at
  }, [events])

  const q = query.trim().toLowerCase()
  const titleOf = (thread: ThreadMeta) => relabelMentions(thread.title, thread.titleRefs, agents)
  const rowMatches = (row: Row) =>
    titleOf(row.thread).toLowerCase().includes(q) || row.thread.agentLabel.toLowerCase().includes(q)
  const todoMatches = (todo: Todo) =>
    todo.text.toLowerCase().includes(q) ||
    (agents.find(a => a.id === todo.agentId)?.label.toLowerCase().includes(q) ?? false)

  const visible = q ? rows.filter(rowMatches) : rows
  const byRecency = (a: Row, b: Row) =>
    (lastMessageAt[b.thread.id] ?? 0) - (lastMessageAt[a.thread.id] ?? 0)
  const inProgress = visible.filter(r => r.state === 'working' && r.thread.status !== 'archived')
  const needsReview = visible
    .filter(r => r.state === 'ready' || r.state === 'failed')
    .sort(byRecency)
  const done = visible.filter(r => r.state === 'done')
  const archived = visible.filter(r => r.thread.status === 'archived').sort(byRecency)
  const pendingTodos = todos.filter(t => !t.checked && (!q || todoMatches(t)))
  const checkedTodos = todos.filter(t => t.checked && (!q || todoMatches(t)))

  // The two kinds of done task stand in one list, newest first, so the date
  // beside each row is what the order reads as.
  const doneEntries: DoneEntry[] = [
    ...done.map(row => ({ row, ts: lastMessageAt[row.thread.id] ?? 0 })),
    ...checkedTodos.map(todo => ({ todo, ts: todo.checkedTs ?? checkedAt[todo.id] ?? todo.ts }))
  ].sort((a, b) => b.ts - a.ts)
  const noMatches =
    q !== '' &&
    inProgress.length + needsReview.length + done.length + archived.length === 0 &&
    pendingTodos.length + checkedTodos.length === 0

  const dayStamp = (ts: number) =>
    ts > 0 && (
      <span className="h-[22px] shrink-0 flex items-center">
        <Tooltip label={formatFullTime(ts)}>
          <span className="text-sm text-fg-faint">{formatShortDay(ts)}</span>
        </Tooltip>
      </span>
    )

  const item = (row: Row, action?: RowAction, ts = 0) => {
    const agent = agents.find(a => a.id === row.thread.agentId)
    return (
    <div key={row.thread.id} className="group relative">
      <button
        onClick={() => onOpenThread(row.thread.id)}
        className="w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-3 transition-colors duration-150 group-hover:bg-ink-hover"
      >
        <span className="h-[22px] shrink-0 flex items-center">
          <StateIcon state={row.state} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-base text-fg">
            {row.thread.ghost && <GhostGlyph className="w-4 h-4 shrink-0 text-fg-muted" />}
            <span className="min-w-0 truncate">
              {stripMention(titleOf(row.thread), row.thread.agentLabel) || titleOf(row.thread)}
            </span>
          </span>
          <span className="block text-sm text-fg-muted truncate">
            {agent ? (
              <AgentName agent={agent}>
                <span className="cursor-default rounded-md px-0.5 -mx-0.5 transition-colors hover:bg-fg/10">
                  {row.thread.agentLabel}
                </span>
              </AgentName>
            ) : (
              row.thread.agentLabel
            )}
            {row.detail ? ` · ${row.detail}` : ''}
          </span>
        </span>
        {dayStamp(ts)}
      </button>
      {action && (
        <span className="absolute inset-y-0 right-0 rounded-r-xl bg-ink-hover pl-1 pr-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <span className="absolute right-full inset-y-0 w-10 bg-gradient-to-l from-ink-hover to-transparent pointer-events-none" />
          <Tooltip label={action.label}>
            <button
              onClick={() => setThreadStatus(row.thread.id, action.status)}
              aria-label={action.label}
              className="w-8 h-8 rounded-full bg-ink-800 text-fg-muted flex items-center justify-center transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95"
            >
              {action.icon}
            </button>
          </Tooltip>
        </span>
      )}
    </div>
    )
  }

  const todoItem = (todo: Todo) => {
    const agent = agents.find(a => a.id === todo.agentId)
    if (editingId === todo.id) {
      return (
        <TodoEditor
          key={todo.id}
          initial={agent ? `@${agent.label} ${todo.text}` : todo.text}
          onCommit={raw => {
            const parsed = parseTodoInput(raw, agents)
            editTodo(todo.id, parsed.text, parsed.agentId)
          }}
          onDone={() => setEditingId(null)}
        />
      )
    }
    const focused = picker?.todoId === todo.id
    return (
      <div key={todo.id} className="group relative">
        <div
          className={`px-3 py-2.5 rounded-xl flex items-start gap-3 transition-colors duration-150 group-hover:bg-ink-hover ${
            focused ? 'bg-ink-hover' : ''
          }`}
        >
          <span className="h-[22px] shrink-0 flex items-center">
            <Tooltip label="Check off">
              <button
                onClick={() => checkTodo(todo.id, true)}
                aria-label="Check off"
                className="w-4 h-4 rounded-full border-[1.5px] border-fg-muted text-transparent flex items-center justify-center transition-colors duration-150 hover:border-fg hover:text-fg"
              >
                <CheckGlyph className="w-3 h-3" />
              </button>
            </Tooltip>
          </span>
          <span className="min-w-0 flex-1 cursor-text" onClick={() => setEditingId(todo.id)}>
            <span className="block text-base text-fg whitespace-pre-wrap break-words">{todo.text}</span>
            {agent && (
              <span className="block text-sm text-fg-muted truncate">
                <AgentName agent={agent}>
                  <span className="cursor-default rounded-md px-0.5 -mx-0.5 transition-colors hover:bg-fg/10">
                    @{agent.label}
                  </span>
                </AgentName>
              </span>
            )}
          </span>
        </div>
        <span
          className={`absolute inset-y-0 right-0 rounded-r-xl bg-ink-hover pl-1 pr-2 flex items-center gap-1.5 transition-opacity duration-150 ${
            focused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <span className="absolute right-full inset-y-0 w-10 bg-gradient-to-l from-ink-hover to-transparent pointer-events-none" />
          <Tooltip label="Delete">
            <button
              onClick={() => removeTodo(todo.id)}
              aria-label="Delete"
              className="w-8 h-8 rounded-full bg-ink-800 text-fg-muted flex items-center justify-center transition-all duration-150 hover:bg-ink-700 hover:text-danger active:scale-95"
            >
              <TrashGlyph className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <button
            onClick={e => {
              if (agent) doTodo(todo.id)
              else setPicker({ todoId: todo.id, at: { x: e.clientX, y: e.clientY } })
            }}
            className="h-8 px-3.5 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-all duration-150 hover:scale-105 active:scale-95"
          >
            Do
          </button>
        </span>
      </div>
    )
  }

  const checkedItem = (todo: Todo, ts: number) => (
    <div key={todo.id} className="group relative">
      <div className="px-3 py-2.5 rounded-xl flex items-start gap-3 transition-colors duration-150 group-hover:bg-ink-hover">
        <span className="h-[22px] shrink-0 flex items-center">
          <Tooltip label="Reopen">
            <button
              onClick={() => checkTodo(todo.id, false)}
              aria-label="Reopen"
              className="w-4 h-4 rounded-full bg-fg text-ink-900 flex items-center justify-center transition-transform duration-150 active:scale-90"
            >
              <CheckGlyph className="w-3 h-3" />
            </button>
          </Tooltip>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base text-fg-muted line-through whitespace-pre-wrap break-words">{todo.text}</span>
          <span className="block text-sm text-fg-faint truncate">Done by hand</span>
        </span>
        {dayStamp(ts)}
      </div>
      <span className="absolute inset-y-0 right-0 rounded-r-xl bg-ink-hover pl-1 pr-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span className="absolute right-full inset-y-0 w-10 bg-gradient-to-l from-ink-hover to-transparent pointer-events-none" />
        <Tooltip label="Delete">
          <button
            onClick={() => removeTodo(todo.id)}
            aria-label="Delete"
            className="w-8 h-8 rounded-full bg-ink-800 text-fg-muted flex items-center justify-center transition-all duration-150 hover:bg-ink-700 hover:text-danger active:scale-95"
          >
            <TrashGlyph className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </span>
    </div>
  )

  const heading = (title: string, count: number) => (
    <h3 className="px-3 mb-1 text-sm font-semibold text-fg-muted">
      {title} {count > 0 && <span className="text-fg-faint">{count}</span>}
    </h3>
  )

  const toggleHeading = (title: string, count: number, shown: boolean, onToggle: () => void) => (
    <button
      onClick={onToggle}
      className="px-3 -ml-1 mb-1 flex items-center gap-1.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg-secondary"
    >
      {shown ? (
        <ChevronDownGlyph className="w-3.5 h-3.5" />
      ) : (
        <ChevronRightGlyph className="w-3.5 h-3.5" />
      )}
      {title} <span className="text-fg-faint">{count}</span>
    </button>
  )

  const online = agents.filter(a => a.status !== 'offline')

  return (
    <>
      {open && <div className="absolute inset-0 z-40" onClick={onClose} />}
      <div className="absolute inset-0 z-50 overflow-hidden pointer-events-none">
        <aside
          className={`app-no-drag pointer-events-auto absolute inset-y-0 right-0 w-[380px] bg-ink-900 border-l border-ink-700 shadow-2xl shadow-black/40 light:shadow-black/10 flex flex-col transition-transform duration-200 ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <header className="h-[70px] px-5 flex items-center shrink-0">
            {searching ? (
              <>
                <SearchGlyph className="w-4 h-4 shrink-0 text-fg-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      closeSearch()
                    }
                  }}
                  placeholder="Search tasks"
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
                <h2 className="flex-1 text-lg font-bold text-fg">Tasks</h2>
                <button
                  onClick={() => setSearching(true)}
                  aria-label="Search tasks"
                  className="w-9 h-9 mr-1 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
                >
                  <SearchGlyph className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close tasks"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
                >
                  <CloseGlyph className="w-4 h-4" />
                </button>
              </>
            )}
          </header>
          <div className="relative flex-1 min-h-0">
            <div ref={scrollRef} className="h-full overflow-y-auto px-3 pb-6 space-y-6">
              {(pendingTodos.length > 0 || !q) && (
                <section>
                  {heading('Todo', pendingTodos.length)}
                  {pendingTodos.map(todoItem)}
                  {!q &&
                    (adding ? (
                      <TodoEditor
                        keepOpen
                        onCommit={raw => {
                          const parsed = parseTodoInput(raw, agents)
                          addTodo(parsed.text, parsed.agentId)
                        }}
                        onDone={() => setAdding(false)}
                      />
                    ) : (
                      <button
                        onClick={() => setAdding(true)}
                        className="w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-3 text-fg-muted transition-colors duration-150 hover:bg-ink-hover hover:text-fg"
                      >
                        <span className="h-[22px] shrink-0 flex items-center">
                          <span className="w-4 h-4 rounded-full border-[1.5px] border-dashed border-fg-faint flex items-center justify-center">
                            <PlusGlyph className="w-3 h-3" />
                          </span>
                        </span>
                        <span className="text-base">Add a task</span>
                      </button>
                    ))}
                </section>
              )}
              {!q && rows.length === 0 && todos.length === 0 && (
                <p className="text-base text-fg-muted text-center mt-16 px-6">
                  Threads you start with an agent will show up here.
                </p>
              )}
              {noMatches && (
                <p className="text-base text-fg-muted text-center mt-16 px-6">No tasks match.</p>
              )}
              {inProgress.length > 0 && (
                <section>
                  {heading('In progress', inProgress.length)}
                  {inProgress.map(row => item(row))}
                </section>
              )}
              {needsReview.length > 0 && (
                <section>
                  {heading('Needs review', needsReview.length)}
                  {needsReview.map(row =>
                    item(row, { icon: <CheckGlyph className="w-4 h-4" />, label: 'Mark done', status: 'done' })
                  )}
                </section>
              )}
              {doneEntries.length > 0 && (
                <section>
                  {toggleHeading('Done', doneEntries.length, showDone || q !== '', () =>
                    setShowDone(v => !v)
                  )}
                  {(showDone || q !== '') &&
                    doneEntries.map(entry =>
                      entry.row
                        ? item(
                            entry.row,
                            { icon: <UndoGlyph className="w-4 h-4" />, label: 'Reopen', status: 'open' },
                            entry.ts
                          )
                        : checkedItem(entry.todo, entry.ts)
                    )}
                </section>
              )}
              {archived.length > 0 && (
                <section>
                  {toggleHeading('Archived', archived.length, showArchived || q !== '', () =>
                    setShowArchived(v => !v)
                  )}
                  {(showArchived || q !== '') &&
                    archived.map(row =>
                      item(
                        row,
                        { icon: <UnarchiveGlyph className="w-4 h-4" />, label: 'Unarchive', status: 'open' },
                        lastMessageAt[row.thread.id] ?? 0
                      )
                    )}
                </section>
              )}
            </div>
            <ScrollFade edges={edges} />
          </div>
        </aside>
      </div>
      <Popover
        open={picker !== null}
        onClose={() => setPicker(null)}
        at={picker?.at}
        maxHeight={224}
        className="w-64"
      >
        {online.length === 0 ? (
          <p className="px-3 py-2 text-sm text-fg-muted whitespace-nowrap">No agents online</p>
        ) : (
          online.map(a => (
            <AgentRow
              key={a.id}
              agent={a}
              onClick={() => {
                if (picker) doTodo(picker.todoId, a.id)
                setPicker(null)
              }}
            />
          ))
        )}
      </Popover>
    </>
  )
}
