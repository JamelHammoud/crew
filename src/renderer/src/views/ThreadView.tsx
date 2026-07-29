import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import AgentIcon from '../components/AgentIcon'
import CommandChip from '../components/CommandChip'
import Composer from '../components/Composer'
import FilesChanged from '../components/FilesChanged'
import FindBar from '../components/FindBar'
import GhostBar from '../components/GhostBar'
import JumpToBottom from '../components/JumpToBottom'
import { MemberName } from '../components/Mention'
import { MentionMenu, useMentionAutocomplete } from '../components/MentionAutocomplete'
import QueueBar, { type QueuedMessage } from '../components/QueueBar'
import Pill from '../components/Pill'
import { SlashMenu, useSlashCommands } from '../components/SlashCommands'
import { usePresence } from '../components/presence'
import ReplyPreview from '../components/ReplyPreview'
import RunStatus from '../components/RunStatus'
import Spinner from '../components/Spinner'
import Counts from '../components/Counts'
import ThreadItems from '../components/ThreadItems'
import Tooltip from '../components/Tooltip'
import { buildThread, eventsOfThread, THREAD_STATE_LABELS, threadState, type ThreadItem } from '../components/thread'
import { useAutoResize } from '../components/useAutoResize'
import { useStickToBottom } from '../components/useStickToBottom'
import { commandTyped, threadCommands, type CommandName } from '../../../shared/commands'
import { mentionsIn } from '../../../shared/llm'
import {
  ArchiveGlyph,
  CheckGlyph,
  ChecklistGlyph,
  ChevronLeftGlyph,
  EyeGlyph,
  TicketGlyph,
  WarningGlyph
} from '../icons'
import { useBrowser } from '../state/browser'
import { pendingCount, useCrew } from '../state/store'

const BACK_WIDTH = 40
const AVATAR_WIDTH = 52
const NAME_MIN_WIDTH = 96
const EMPTY_COMMANDS: CommandName[] = []

export default function ThreadView({ threadId }: { threadId: string }) {
  const events = useCrew(s => s.events)
  const steps = useCrew(s => s.steps)
  const selfId = useCrew(s => s.selfId)
  const thread = useCrew(s => s.threads[threadId])
  const activePromptId = useCrew(s => s.threadPrompts[threadId])
  const tokens = useCrew(s => (activePromptId ? (s.tokens[activePromptId] ?? 0) : 0))
  const cost = useCrew(s => (activePromptId ? s.costs[activePromptId] : undefined))
  const sendChat = useCrew(s => s.sendChat)
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const setThreadStatus = useCrew(s => s.setThreadStatus)
  const editQueued = useCrew(s => s.editQueued)
  const removeQueued = useCrew(s => s.removeQueued)
  const closeThread = useCrew(s => s.closeThread)
  const text = useCrew(s => s.threadDrafts[threadId] ?? '')
  const setThreadDraft = useCrew(s => s.setThreadDraft)
  const agents = useCrew(s => s.agents)
  const planShowing = useBrowser(s => {
    const shown = s.tabs.find(t => t.id === s.activeTabId)
    return shown?.kind === 'plan' && shown.threadId === threadId
  })
  const boardShowing = useBrowser(s => {
    const shown = s.tabs.find(t => t.id === s.activeTabId)
    return shown?.kind === 'work' && shown.threadId === threadId
  })
  const helpersShowing = useBrowser(s => {
    const shown = s.tabs.find(t => t.id === s.activeTabId)
    return shown?.kind === 'agent' && shown.parentThreadId === threadId
  })
  const [replyTo, setReplyTo] = useState<ThreadItem | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const { scrolledUp, atBottom, onScroll, jumpToBottom, follow } = useStickToBottom(scrollRef, `thread:${threadId}`)
  const inputRef = useAutoResize(text)
  const agentPresence = usePresence(thread?.agentLabel ?? '', thread?.agentId)

  const threadEvents = useMemo(() => eventsOfThread(events, threadId), [events, threadId])
  // The way back to the helpers this thread sent out. The chips scroll away with
  // the words they arrived under, so a thread that has ever sent one keeps a way
  // in that stands still.
  const sentHelpers = threadEvents.some(e => e.kind === 'subagent.started')
  const runningStart = threadEvents.find(e => e.kind === 'agent.start' && e.promptId === activePromptId)
  const runningAgentId = runningStart?.kind === 'agent.start' ? runningStart.agentId : undefined
  const steerable = useCrew(s => s.agents.find(a => a.id === runningAgentId)?.steerable === true)
  const draftMentions = useMemo(() => mentionsIn(text, agents), [text, agents])
  const targets = draftMentions.length > 0 ? draftMentions : thread ? [thread.agentId] : []
  const canSteer =
    Boolean(activePromptId) && steerable && runningAgentId !== undefined && targets.includes(runningAgentId)

  // A thread's command is one choice about the message being written, so one is
  // held at a time and picking another takes the place of the one before it. The
  // run it was picked against can end while the message is still being typed, so
  // what stands is read back off what the thread can still do.
  const offered = useMemo(() => threadCommands(canSteer), [canSteer])
  const held = useCrew(s => s.threadCommands[threadId] ?? EMPTY_COMMANDS)
  const setThreadCommands = useCrew(s => s.setThreadCommands)
  const command = held.find(name => offered.some(one => one.name === name)) ?? null

  const takeCommand = (name: CommandName) => setThreadCommands(threadId, [name])

  const write = (value: string) => {
    const typed = commandTyped(value, offered)
    if (!typed) {
      setThreadDraft(threadId, value)
      return
    }
    takeCommand(typed)
    setThreadDraft(threadId, '')
  }

  const mention = useMentionAutocomplete(text, write, inputRef)
  const slash = useSlashCommands(text, write, takeCommand, inputRef, offered)
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
    // A question on the side is answered in the panel and never lands here, so
    // it is not a reply to anything in the thread.
    const asking = command === 'btw'
    sendChat(
      text,
      threadId,
      undefined,
      asking ? undefined : replyTo?.reactionTargetId,
      undefined,
      command ? [command] : undefined
    )
    setReplyTo(null)
    mention.close()
    slash.close()
    if (!asking) jumpToBottom()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && replyTo) {
      e.preventDefault()
      setReplyTo(null)
      return
    }
    if (e.key === 'Backspace' && !text && command) {
      e.preventDefault()
      setThreadCommands(threadId, [])
      return
    }
    if (slash.onKeyDown(e)) return
    if (mention.onKeyDown(e)) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (!thread) return null

  const placeholder =
    command === 'btw' ? 'Ask about this thread, off to the side' : 'Send a message or @ someone'
  const state = threadState(thread, threadEvents, Boolean(activePromptId))
  const statusAction =
    thread.status === 'open'
      ? { label: 'Mark done', to: 'done' as const }
      : { label: thread.status === 'done' ? 'Reopen' : 'Unarchive', to: 'open' as const }

  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0 relative">
        <FindBar containerRef={contentRef} scrollerRef={scrollRef} placeholder="Find in thread" />
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-6">
          <div
            ref={contentRef}
            className="max-w-[660px] mx-auto pt-28 space-y-5"
            style={{ paddingBottom: Math.max(120, overlayHeight - 16) }}
          >
            <ThreadItems
              threadId={threadId}
              items={items}
              onReply={item => {
                setReplyTo(item)
                inputRef.current?.focus()
              }}
            />
            {activePromptId && startedAt && (
              <RunStatus startedAt={startedAt} tokens={tokens} cost={cost} steps={steps[activePromptId] ?? []} />
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
              {thread.ghost && <GhostBar />}
              <div
                className={`relative bg-ink-900 border border-b-0 border-ink-700 rounded-t-[30px] pb-12 -mb-9 ${
                  thread.ghost ? 'border-dashed' : ''
                }`}
              >
                <div ref={setHeaderRow} className="flex items-center gap-3 px-3 pt-2.5">
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
                    {thread.tickets && (
                      <Tooltip label={boardShowing ? 'Hide board' : 'Show board'}>
                        <button
                          onClick={() =>
                            boardShowing
                              ? useBrowser.getState().closeWork()
                              : useBrowser.getState().showWork(threadId)
                          }
                          aria-label={boardShowing ? 'Hide board' : 'Show board'}
                          aria-pressed={boardShowing}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 ${
                            boardShowing ? 'bg-ink-700 text-fg' : 'bg-ink-800 text-fg-secondary hover:bg-ink-700 hover:text-fg'
                          }`}
                        >
                          <TicketGlyph className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    )}
                    {sentHelpers && (
                      <Tooltip label={helpersShowing ? 'Hide helpers' : 'Show helpers'}>
                        <button
                          onClick={() =>
                            helpersShowing
                              ? useBrowser.getState().closeSubagents(threadId)
                              : useBrowser.getState().showSubagents(threadId)
                          }
                          aria-label={helpersShowing ? 'Hide helpers' : 'Show helpers'}
                          aria-pressed={helpersShowing}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 ${
                            helpersShowing
                              ? 'bg-ink-700 text-fg'
                              : 'bg-ink-800 text-fg-secondary hover:bg-ink-700 hover:text-fg'
                          }`}
                        >
                          <GroupGlyph className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    )}
                    {thread.plan && (
                      <Tooltip label={planShowing ? 'Hide plan' : 'Show plan'}>
                        <button
                          onClick={() =>
                            planShowing
                              ? useBrowser.getState().closePlan()
                              : useBrowser.getState().showPlan(threadId)
                          }
                          aria-label={planShowing ? 'Hide plan' : 'Show plan'}
                          aria-pressed={planShowing}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 ${
                            planShowing ? 'bg-ink-700 text-fg' : 'bg-ink-800 text-fg-secondary hover:bg-ink-700 hover:text-fg'
                          }`}
                        >
                          <ChecklistGlyph className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
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
                  sendLabel={
                    command === 'btw' ? 'Ask' : canSteer && command !== 'queue' ? 'Steer' : 'Send'
                  }
                  ghost={thread.ghost}
                  chips={
                    command && (
                      <CommandChip name={command} onRemove={() => setThreadCommands(threadId, [])} />
                    )
                  }
                >
                  <MentionMenu
                    matches={mention.matches}
                    activeIndex={mention.activeIndex}
                    onPick={mention.pick}
                    onHover={mention.setActive}
                  />
                  <SlashMenu
                    matches={slash.matches}
                    activeIndex={slash.activeIndex}
                    onPick={slash.pick}
                    onHover={slash.setActive}
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
