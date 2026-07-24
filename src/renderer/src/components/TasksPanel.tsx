import {
  ArchiveBoxXMarkIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/16/solid'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Todo } from '../../../shared/events'
import { mentionsIn, type PooledAgent } from '../../../shared/llm'
import { useCrew, type ThreadMeta } from '../state/store'
import { AgentName } from './Mention'
import { AgentRow, MentionMenu, useMentionAutocomplete } from './MentionAutocomplete'
import { useAutoResize } from './useAutoResize'
import { Popover } from './Popover'
import { StateIcon } from './ThreadCard'
import { describeStep, endPreview, lastEnd, threadState, type ThreadState } from './thread'
import Tooltip from './Tooltip'

interface Row {
  thread: ThreadMeta
  state: ThreadState
  detail: string
}

interface RowAction {
  icon: ReactNode
  label: string
  status: ThreadMeta['status']
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const stripMention = (text: string, label: string) =>
  text
    .replace(new RegExp(`@${escapeRegExp(label)}(?![\\w-])`, 'i'), ' ')
    .replace(/\s+/g, ' ')
    .trim()

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
  const mention = useMentionAutocomplete(value, setValue, inputRef)

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

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = []
    for (const e of events) {
      if (e.kind !== 'thread.started' || !threads[e.threadId]) continue
      const thread = threads[e.threadId]
      const promptId = threadPrompts[thread.id]
      const working = Boolean(promptId) || (queues[thread.id]?.length ?? 0) > 0
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

  const checkedAt = useMemo(() => {
    const at: Record<string, number> = {}
    for (const e of events) {
      if (e.kind === 'todo.checked' && e.checked) at[e.todoId] = e.ts
    }
    return at
  }, [events])

  const q = query.trim().toLowerCase()
  const rowMatches = (row: Row) =>
    row.thread.title.toLowerCase().includes(q) || row.thread.agentLabel.toLowerCase().includes(q)
  const todoMatches = (todo: Todo) =>
    todo.text.toLowerCase().includes(q) ||
    (agents.find(a => a.id === todo.agentId)?.label.toLowerCase().includes(q) ?? false)

  const visible = q ? rows.filter(rowMatches) : rows
  const byRecency = (a: Row, b: Row) =>
    (lastMessageAt[b.thread.id] ?? 0) - (lastMessageAt[a.thread.id] ?? 0)
  const inProgress = visible.filter(r => r.state === 'working' && r.thread.status !== 'archived')
  const needsReview = visible.filter(r => r.state === 'ready' || r.state === 'failed')
  const done = visible.filter(r => r.state === 'done').sort(byRecency)
  const archived = visible.filter(r => r.thread.status === 'archived').sort(byRecency)
  const pendingTodos = todos.filter(t => !t.checked && (!q || todoMatches(t)))
  const checkedTodos = todos.filter(t => t.checked && (!q || todoMatches(t)))
  const noMatches =
    q !== '' &&
    inProgress.length + needsReview.length + done.length + archived.length === 0 &&
    pendingTodos.length + checkedTodos.length === 0

  const item = (row: Row, action?: RowAction) => {
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
          <span className="block text-base text-fg truncate">
            {stripMention(row.thread.title, row.thread.agentLabel) || row.thread.title}
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
                <CheckIcon className="w-3 h-3" />
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
              <TrashIcon className="w-3.5 h-3.5" />
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

  const checkedItem = (todo: Todo) => (
    <div key={todo.id} className="group relative">
      <div className="px-3 py-2.5 rounded-xl flex items-start gap-3 transition-colors duration-150 group-hover:bg-ink-hover">
        <span className="h-[22px] shrink-0 flex items-center">
          <Tooltip label="Reopen">
            <button
              onClick={() => checkTodo(todo.id, false)}
              aria-label="Reopen"
              className="w-4 h-4 rounded-full bg-fg text-ink-900 flex items-center justify-center transition-transform duration-150 active:scale-90"
            >
              <CheckIcon className="w-3 h-3" />
            </button>
          </Tooltip>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base text-fg-muted line-through whitespace-pre-wrap break-words">{todo.text}</span>
          <span className="block text-sm text-fg-faint truncate">Done by hand</span>
        </span>
      </div>
      <span className="absolute inset-y-0 right-0 rounded-r-xl bg-ink-hover pl-1 pr-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span className="absolute right-full inset-y-0 w-10 bg-gradient-to-l from-ink-hover to-transparent pointer-events-none" />
        <Tooltip label="Delete">
          <button
            onClick={() => removeTodo(todo.id)}
            aria-label="Delete"
            className="w-8 h-8 rounded-full bg-ink-800 text-fg-muted flex items-center justify-center transition-all duration-150 hover:bg-ink-700 hover:text-danger active:scale-95"
          >
            <TrashIcon className="w-3.5 h-3.5" />
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
        <ChevronDownIcon className="w-3.5 h-3.5" />
      ) : (
        <ChevronRightIcon className="w-3.5 h-3.5" />
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
              <MagnifyingGlassIcon className="w-4 h-4 shrink-0 text-fg-muted" />
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
                <XMarkIcon className="w-4 h-4" />
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
                <MagnifyingGlassIcon className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                aria-label="Close tasks"
                className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </>
          )}
        </header>
        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-6">
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
                        <PlusIcon className="w-3 h-3" />
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
                item(row, { icon: <CheckIcon className="w-4 h-4" />, label: 'Mark done', status: 'done' })
              )}
            </section>
          )}
          {(done.length > 0 || checkedTodos.length > 0) && (
            <section>
              {toggleHeading('Done', done.length + checkedTodos.length, showDone || q !== '', () =>
                setShowDone(v => !v)
              )}
              {(showDone || q !== '') &&
                [
                  ...done.map(row => ({
                    ts: lastMessageAt[row.thread.id] ?? 0,
                    node: item(row, {
                      icon: <ArrowUturnLeftIcon className="w-4 h-4" />,
                      label: 'Reopen',
                      status: 'open' as const
                    })
                  })),
                  ...checkedTodos.map(todo => ({
                    ts: checkedAt[todo.id] ?? todo.ts,
                    node: checkedItem(todo)
                  }))
                ]
                  .sort((a, b) => b.ts - a.ts)
                  .map(entry => entry.node)}
            </section>
          )}
          {archived.length > 0 && (
            <section>
              {toggleHeading('Archived', archived.length, showArchived || q !== '', () =>
                setShowArchived(v => !v)
              )}
              {(showArchived || q !== '') &&
                archived.map(row =>
                  item(row, { icon: <ArchiveBoxXMarkIcon className="w-4 h-4" />, label: 'Unarchive', status: 'open' })
                )}
            </section>
          )}
        </div>
      </aside>
      <Popover
        open={picker !== null}
        onClose={() => setPicker(null)}
        at={picker?.at}
        className="w-64 max-h-56 overflow-y-auto"
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
