import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import AgentIcon from '../components/AgentIcon'
import Composer from '../components/Composer'
import FilesChanged from '../components/FilesChanged'
import GhostBar from '../components/GhostBar'
import JumpToBottom from '../components/JumpToBottom'
import { MemberName } from '../components/Mention'
import { MentionMenu, useMentionAutocomplete } from '../components/MentionAutocomplete'
import QueueBar, { type QueuedMessage } from '../components/QueueBar'
import Pill from '../components/Pill'
import { usePresence } from '../components/presence'
import ReplyPreview from '../components/ReplyPreview'
import RunStatus from '../components/RunStatus'
import Spinner from '../components/Spinner'
import Counts from '../components/Counts'
import ThreadItems from '../components/ThreadItems'
import Tooltip from '../components/Tooltip'
import { buildThread, THREAD_STATE_LABELS, threadState, type ThreadItem } from '../components/thread'
import { useAutoResize } from '../components/useAutoResize'
import { useStickToBottom } from '../components/useStickToBottom'
import { mentionsIn } from '../../../shared/llm'
import { ArchiveGlyph, CheckGlyph, ChevronLeftGlyph, EyeGlyph, WarningGlyph } from '../icons'
import { pendingCount, useCrew } from '../state/store'

const BACK_WIDTH = 40
const AVATAR_WIDTH = 52
const NAME_MIN_WIDTH = 96

export default function ThreadView({ threadId }: { threadId: string }) {
  const events = useCrew(s => s.events)
  const steps = useCrew(s => s.steps)
  const selfId = useCrew(s => s.selfId)
  const thread = useCrew(s => s.threads[threadId])
  const activePromptId = useCrew(s => s.threadPrompts[threadId])
  const tokens = useCrew(s => (activePromptId ? (s.tokens[activePromptId] ?? 0) : 0))
  const sendChat = useCrew(s => s.sendChat)
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const setThreadStatus = useCrew(s => s.setThreadStatus)
  const editQueued = useCrew(s => s.editQueued)
  const removeQueued = useCrew(s => s.removeQueued)
  const closeThread = useCrew(s => s.closeThread)
  const text = useCrew(s => s.threadDrafts[threadId] ?? '')
  const setThreadDraft = useCrew(s => s.setThreadDraft)
  const agents = useCrew(s => s.agents)
  const [replyTo, setReplyTo] = useState<ThreadItem | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrolledUp, atBottom, onScroll, jumpToBottom, follow } = useStickToBottom(scrollRef, `thread:${threadId}`)
  const inputRef = useAutoResize(text)
  const mention = useMentionAutocomplete(text, value => setThreadDraft(threadId, value), inputRef)
  const agentPresence = usePresence(thread?.agentLabel ?? '', thread?.agentId)

  const threadEvents = useMemo(() => events.filter(e => 'threadId' in e && e.threadId === threadId), [events, threadId])
  const runningStart = threadEvents.find(e => e.kind === 'agent.start' && e.promptId === activePromptId)
  const runningAgentId = runningStart?.kind === 'agent.start' ? runningStart.agentId : undefined
  const steerable = useCrew(s => s.agents.find(a => a.id === runningAgentId)?.steerable === true)
  const draftMentions = useMemo(() => mentionsIn(text, agents), [text, agents])
  const items = useMemo(() => buildThread(threadEvents, steps, selfId, agents), [threadEvents, steps, selfId, agents])
  const threadSteps = useMemo(() => {
    const promptIds = threadEvents.filter(e => e.kind === 'agent.start').map(e => e.promptId)
    return promptIds.flatMap(promptId => steps[promptId] ?? [])
  }, [threadEvents, steps])
  const queueItems = useCrew(s => s.queues[threadId])
  const queuedMessages = useMemo<QueuedMessage[]>(
    () =>
      (queueItems ?? []).map(item => {
        const label = agents.find(a => a.id === item.agentId)?.label ?? item.agentLabel
        return {
          promptId: item.promptId,
          author: item.authorName,
          self: item.authorId === selfId,
          text: item.text,
          agentLabel: item.agentId !== thread?.agentId ? label : undefined
        }
      }),
    [agents, queueItems, selfId, thread?.agentId]
  )
  const startedAt = runningStart?.ts
  const diffTotals = useMemo(() => {
    let added = 0
    let removed = 0
    const paths = new Set<string>()
    for (const step of threadSteps) {
      for (const file of step.files ?? []) {
        added += file.added
        removed += file.removed
        paths.add(file.path)
      }
    }
    return { added, removed, files: paths.size }
  }, [threadSteps])

  const overlayRef = useRef<HTMLDivElement>(null)
  const [overlayHeight, setOverlayHeight] = useState(240)
  const [headerRow, setHeaderRow] = useState<HTMLDivElement | null>(null)
  const [headerStatus, setHeaderStatus] = useState<HTMLDivElement | null>(null)
  const [nameWidth, setNameWidth] = useState(Number.POSITIVE_INFINITY)

  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setOverlayHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!headerRow || !headerStatus) return
    const measure = () => {
      const style = getComputedStyle(headerRow)
      const gap = parseFloat(style.columnGap) || 0
      const inner = headerRow.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      setNameWidth(inner - BACK_WIDTH - headerStatus.offsetWidth - gap * 2)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(headerRow)
    observer.observe(headerStatus)
    return () => observer.disconnect()
  }, [headerRow, headerStatus])

  useLayoutEffect(() => {
    follow()
  }, [items, overlayHeight, follow])

  const send = () => {
    if (!text.trim() && pendingCount(threadId) === 0) return
    sendChat(text, threadId, undefined, replyTo?.reactionTargetId)
    setReplyTo(null)
    mention.close()
    jumpToBottom()
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

  if (!thread) return null

  const targets = draftMentions.length > 0 ? draftMentions : [thread.agentId]
  const canSteer =
    Boolean(activePromptId) && steerable && runningAgentId !== undefined && targets.includes(runningAgentId)
  const placeholder = 'Send a message or @ someone'
  const state = threadState(thread, threadEvents, Boolean(activePromptId))
  const statusAction =
    thread.status === 'open'
      ? { label: 'Mark done', to: 'done' as const }
      : { label: thread.status === 'done' ? 'Reopen' : 'Unarchive', to: 'open' as const }

  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0 relative">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-6">
          <div className="max-w-[660px] mx-auto pt-28 space-y-5" style={{ paddingBottom: Math.max(120, overlayHeight - 16) }}>
            <ThreadItems
              items={items}
              onReply={item => {
                setReplyTo(item)
                inputRef.current?.focus()
              }}
            />
            {activePromptId && startedAt && (
              <RunStatus startedAt={startedAt} tokens={tokens} steps={steps[activePromptId] ?? []} />
            )}
            <FilesChanged steps={threadSteps} />
          </div>
        </div>

        <div ref={overlayRef} className="absolute inset-x-0 bottom-0 pointer-events-none">
          <div
            className={`h-14 bg-gradient-to-t from-ink-900 to-transparent transition-opacity duration-200 ${atBottom ? 'opacity-0' : 'opacity-100'}`}
          />
          <div className="bg-ink-900 px-6 pb-6">
            <div className="relative max-w-[660px] mx-auto pointer-events-auto">
              {scrolledUp && <JumpToBottom onClick={jumpToBottom} />}
              <QueueBar items={queuedMessages} onEdit={editQueued} onRemove={removeQueued} />
              {replyTo && <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />}
              <div
                ref={setHeaderRow}
                className={`relative bg-ink-900 border border-b-0 border-ink-700 rounded-t-[30px] flex items-center gap-3 px-3 pt-2.5 pb-12 -mb-9 ${
                  thread.ghost ? 'border-dashed' : ''
                }`}
              >
                <Tooltip label="Back to chat">
                  <button
                    onClick={closeThread}
                    aria-label="Back to chat"
                    className="w-10 h-10 rounded-full bg-ink-800 text-fg-secondary flex items-center justify-center transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95 shrink-0"
                  >
                    <ChevronLeftGlyph className="w-5 h-5" />
                  </button>
                </Tooltip>
                <MemberName id={thread.agentId} name={thread.agentLabel} className="min-w-0">
                  <span className="flex items-center gap-3 min-w-0 cursor-default">
                    {nameWidth >= AVATAR_WIDTH + NAME_MIN_WIDTH && (
                      <AgentIcon seed={thread.agentId} presence={agentPresence} />
                    )}
                    <span className="text-base font-bold text-fg truncate">{thread.agentLabel}</span>
                  </span>
                </MemberName>
                <div ref={setHeaderStatus} className="ml-auto flex items-center gap-2 pr-2 shrink-0">
                  {/* Why the answers here are one line each. Without it the
                      thread reads as an agent being terse for no reason. */}
                  {thread.voice && (
                    <span className="mr-1">
                      <Pill lg>Spoken</Pill>
                    </span>
                  )}
                  {state === 'working' ? (
                    <>
                      <Spinner size={16} className="text-fg" />
                      <span className="text-base font-semibold text-fg">Working</span>
                    </>
                  ) : (
                    <>
                      {state === 'done' && <CheckGlyph className="w-5 h-5 text-fg" />}
                      {state === 'ready' && <EyeGlyph className="w-5 h-5 text-fg" />}
                      {state === 'failed' && <WarningGlyph className="w-5 h-5 text-danger" />}
                      {state === 'archived' && <ArchiveGlyph className="w-5 h-5 text-fg-muted" />}
                      <span className={`text-base font-semibold ${state === 'failed' ? 'text-danger' : 'text-fg'}`}>
                        {THREAD_STATE_LABELS[state]}
                      </span>
                      <button
                        onClick={() => setThreadStatus(threadId, statusAction.to)}
                        className="ml-1 h-8 px-3 rounded-full bg-ink-800 text-sm font-semibold text-fg-secondary transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95"
                      >
                        {statusAction.label}
                      </button>
                    </>
                  )}
                  {(diffTotals.added > 0 || diffTotals.removed > 0) && (
                    <Tooltip
                      label={`${diffTotals.added} ${diffTotals.added === 1 ? 'addition' : 'additions'} and ${diffTotals.removed} ${diffTotals.removed === 1 ? 'deletion' : 'deletions'}`}
                    >
                      <span className="ml-2 cursor-default">
                        <Pill lg>
                          <Counts added={diffTotals.added} removed={diffTotals.removed} size="sm" />
                        </Pill>
                      </span>
                    </Tooltip>
                  )}
                </div>
              </div>
              <div className="relative">
                <Composer
                  attachmentKey={threadId}
                  value={text}
                  placeholder={placeholder}
                  inputRef={inputRef}
                  onChange={mention.onChange}
                  onKeyDown={onKeyDown}
                  onSend={send}
                  onStop={activePromptId ? () => cancelPrompt(activePromptId) : undefined}
                  sendLabel={canSteer ? 'Steer' : 'Send'}
                  ghost={thread.ghost}
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
          </div>
        </div>
      </div>
    </div>
  )
}
