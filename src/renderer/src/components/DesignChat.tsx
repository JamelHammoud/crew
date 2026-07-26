import { useEffect, useMemo, useRef, useState } from 'react'
import { mentionsIn } from '../../../shared/llm'
import { useCrew, type ThreadMeta } from '../state/store'
import Composer from './Composer'
import { MentionMenu, useMentionAutocomplete } from './MentionAutocomplete'
import RunStatus from './RunStatus'
import ScrollFade from './ScrollFade'
import ThreadItems from './ThreadItems'
import { buildThread, type ThreadItem } from './thread'
import { useAutoResize } from './useAutoResize'
import useScrollEdges from './useScrollEdges'
import { useStickToBottom } from './useStickToBottom'

export function useBoardThreads(boardId: string): ThreadMeta[] {
  const threads = useCrew(s => s.threads)
  return useMemo(() => Object.values(threads).filter(thread => thread.boardId === boardId), [threads, boardId])
}

export default function DesignChat({
  boardId,
  composeNew,
  onComposeNew
}: {
  boardId: string
  composeNew: boolean
  onComposeNew: (value: boolean) => void
}) {
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

  const boardThreads = useBoardThreads(boardId)
  const [picked, setPicked] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<ThreadItem | null>(null)
  const known = useRef(new Set<string>())

  useEffect(() => {
    const fresh = boardThreads.filter(thread => !known.current.has(thread.id))
    for (const thread of fresh) known.current.add(thread.id)
    if (fresh.length > 0) {
      setPicked(fresh[fresh.length - 1].id)
      onComposeNew(false)
    }
  }, [boardThreads, onComposeNew])

  const fallback = boardThreads.length > 0 ? boardThreads[boardThreads.length - 1].id : null
  const threadId = composeNew ? null : picked && threads[picked] ? picked : fallback
  const key = threadId ?? boardId
  const text = threadDrafts[key] ?? ''
  const pendingCount = useCrew(s => (s.pending[key] ?? []).length)

  const scrollRef = useRef<HTMLDivElement>(null)
  const { pinnedRef, onScroll } = useStickToBottom(scrollRef)
  const { edges } = useScrollEdges(scrollRef)
  const inputRef = useAutoResize(text)
  const mention = useMentionAutocomplete(text, value => setThreadDraft(key, value), inputRef)

  useEffect(() => setReplyTo(null), [threadId])

  const threadEvents = useMemo(
    () => events.filter(e => 'threadId' in e && e.threadId === threadId),
    [events, threadId]
  )
  const items = useMemo(() => buildThread(threadEvents, steps, selfId, agents), [threadEvents, steps, selfId, agents])
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
    sendChat(text, threadId ?? undefined, threadId ? undefined : boardId, replyTo?.reactionTargetId)
    setReplyTo(null)
    mention.close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && replyTo) {
      e.preventDefault()
      setReplyTo(null)
      return
    }
    if (mention.onKeyDown(e)) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const example = agents.find(a => a.status !== 'offline')?.label ?? agents[0]?.label ?? 'an agent'

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col">
      {boardThreads.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2 shrink-0">
          {boardThreads.map(thread => (
            <button
              key={thread.id}
              onClick={() => {
                setPicked(thread.id)
                onComposeNew(false)
              }}
              className={`h-7 px-3 rounded-full text-xs font-semibold max-w-full truncate transition-colors ${
                thread.id === threadId ? 'bg-fg text-ink-900' : 'bg-fg/[0.06] text-fg-muted hover:text-fg'
              }`}
            >
              {thread.title || 'Untitled'}
            </button>
          ))}
        </div>
      )}
      <div className="relative flex-1 min-w-0 min-h-0">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto overflow-x-hidden px-4">
          {threadId ? (
            <div className="space-y-4 py-4">
              <ThreadItems
                items={items}
                onReply={item => {
                  setReplyTo(item)
                  inputRef.current?.focus()
                }}
              />
              {activePromptId && runningStart && (
                <RunStatus
                  startedAt={runningStart.ts}
                  tokens={tokens[activePromptId] ?? 0}
                  steps={steps[activePromptId] ?? []}
                />
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center px-4">
              <p className="text-sm text-fg-muted">
                Mention an agent like @{example} and it will design on this board with you.
              </p>
            </div>
          )}
        </div>
        <ScrollFade edges={edges} />
      </div>
      <div className="px-3 pb-4 shrink-0">
        <Composer
          attachmentKey={key}
          value={text}
          placeholder={threadId ? 'Send a message or @ another agent' : 'Ask an agent to design something'}
          inputRef={inputRef}
          onChange={mention.onChange}
          onKeyDown={onKeyDown}
          onSend={send}
          onStop={activePromptId ? () => cancelPrompt(activePromptId) : undefined}
          replyTo={replyTo ?? undefined}
          onCancelReply={() => setReplyTo(null)}
        >
          <MentionMenu
            matches={mention.matches}
            activeIndex={mention.activeIndex}
            onPick={mention.pick}
            onHover={mention.setActive}
          />
        </Composer>
      </div>
    </div>
  )
}
