import { PlusIcon } from '@heroicons/react/16/solid'
import { XMarkIcon } from '@heroicons/react/20/solid'
import { useEffect, useMemo, useRef, useState } from 'react'
import { mentionsIn } from '../../../shared/llm'
import { useCrew } from '../state/store'
import Composer from './Composer'
import { MentionMenu, useMentionAutocomplete } from './MentionAutocomplete'
import RunStatus from './RunStatus'
import ThreadItems from './ThreadItems'
import Tooltip from './Tooltip'
import { buildThread } from './thread'
import { useAutoResize } from './useAutoResize'
import { useStickToBottom } from './useStickToBottom'

export default function DesignChat({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const events = useCrew(s => s.events)
  const steps = useCrew(s => s.steps)
  const selfId = useCrew(s => s.selfId)
  const threads = useCrew(s => s.threads)
  const agents = useCrew(s => s.agents)
  const threadPrompts = useCrew(s => s.threadPrompts)
  const tokens = useCrew(s => s.tokens)
  const sendChat = useCrew(s => s.sendChat)
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const threadDrafts = useCrew(s => s.threadDrafts)
  const setThreadDraft = useCrew(s => s.setThreadDraft)

  const boardThreads = useMemo(
    () => Object.values(threads).filter(thread => thread.boardId === boardId),
    [threads, boardId]
  )
  const [picked, setPicked] = useState<string | null>(null)
  const [composeNew, setComposeNew] = useState(false)
  const known = useRef(new Set<string>())

  useEffect(() => {
    const fresh = boardThreads.filter(thread => !known.current.has(thread.id))
    for (const thread of fresh) known.current.add(thread.id)
    if (fresh.length > 0) {
      setPicked(fresh[fresh.length - 1].id)
      setComposeNew(false)
    }
  }, [boardThreads])

  const fallback = boardThreads.length > 0 ? boardThreads[boardThreads.length - 1].id : null
  const threadId = composeNew ? null : picked && threads[picked] ? picked : fallback
  const key = threadId ?? boardId
  const text = threadDrafts[key] ?? ''
  const pendingCount = useCrew(s => (s.pending[key] ?? []).length)

  const scrollRef = useRef<HTMLDivElement>(null)
  const { pinnedRef, onScroll } = useStickToBottom(scrollRef)
  const inputRef = useAutoResize(text)
  const mention = useMentionAutocomplete(text, value => setThreadDraft(key, value), inputRef)

  const threadEvents = useMemo(
    () => events.filter(e => 'threadId' in e && e.threadId === threadId),
    [events, threadId]
  )
  const items = useMemo(() => buildThread(threadEvents, steps, selfId), [threadEvents, steps, selfId])
  const activePromptId = threadId ? threadPrompts[threadId] : undefined
  const runningStart = threadEvents.find(e => e.kind === 'agent.start' && e.promptId === activePromptId)

  useEffect(() => {
    const el = scrollRef.current
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight
  }, [items, pinnedRef])

  const draftMentions = useMemo(() => mentionsIn(text, agents), [text, agents])

  const send = () => {
    if (!text.trim() && pendingCount === 0) return
    if (!threadId && draftMentions.length === 0) return
    sendChat(text, threadId ?? undefined, threadId ? undefined : boardId)
    mention.close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mention.onKeyDown(e)) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const example = agents.find(a => a.status !== 'offline')?.label ?? agents[0]?.label ?? 'an agent'

  return (
    <aside className="w-[360px] shrink-0 flex flex-col min-h-0 pt-[70px]">
      <div className="flex items-center gap-2 pl-5 pr-3 h-12 shrink-0">
        <span className="text-sm font-semibold text-fg">Board chat</span>
        <div className="ml-auto flex items-center gap-1">
          {boardThreads.length > 0 && (
            <Tooltip label="New thread">
              <button
                onClick={() => setComposeNew(true)}
                aria-label="New thread"
                className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/[0.06] transition-all active:scale-95"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
          <Tooltip label="Hide chat">
            <button
              onClick={onClose}
              aria-label="Hide chat"
              className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/[0.06] transition-all active:scale-95"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>
      {boardThreads.length > 1 && (
        <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto shrink-0">
          {boardThreads.map(thread => (
            <button
              key={thread.id}
              onClick={() => {
                setPicked(thread.id)
                setComposeNew(false)
              }}
              className={`h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap max-w-[160px] truncate transition-colors ${
                thread.id === threadId ? 'bg-ink-700 text-fg' : 'bg-ink-800 text-fg-muted hover:text-fg-secondary'
              }`}
            >
              {thread.title || 'Untitled'}
            </button>
          ))}
        </div>
      )}
      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-4">
          {threadId ? (
            <div className="space-y-4 py-4">
              <ThreadItems items={items} />
              {activePromptId && runningStart && (
                <RunStatus
                  startedAt={runningStart.ts}
                  tokens={tokens[activePromptId] ?? 0}
                  steps={steps[activePromptId] ?? []}
                />
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center px-6">
              <p className="text-sm text-fg-muted">
                Mention an agent like @{example} and it will design on this board with you.
              </p>
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-ink-900 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-ink-900 to-transparent pointer-events-none" />
      </div>
      <div className="px-4 pb-6 shrink-0">
        <Composer
          attachmentKey={key}
          value={text}
          placeholder={threadId ? 'Send a message or @ another agent' : 'Ask an agent to design something'}
          inputRef={inputRef}
          onChange={mention.onChange}
          onKeyDown={onKeyDown}
          onSend={send}
          onStop={activePromptId ? () => cancelPrompt(activePromptId) : undefined}
        >
          <MentionMenu
            matches={mention.matches}
            activeIndex={mention.activeIndex}
            onPick={mention.pick}
            onHover={mention.setActive}
          />
        </Composer>
      </div>
    </aside>
  )
}
