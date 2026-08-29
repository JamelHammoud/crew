import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import AgentIcon from '../components/AgentIcon'
import CommandChip from '../components/CommandChip'
import Composer, { COMPOSER_MAX } from '../components/Composer'
import FilesChanged from '../components/FilesChanged'
import FindBar from '../components/FindBar'
import ForkedFrom from '../components/ForkedFrom'
import GhostBar from '../components/GhostBar'
import { JumpToBottom, ThreadJumps } from '../components/OverComposer'
import TypingLine from '../components/TypingLine'
import { MemberName } from '../components/Mention'
import { MentionMenu, useMentionAutocomplete } from '../components/MentionAutocomplete'
import QueueBar, { type QueuedMessage } from '../components/QueueBar'
import { SlashMenu, useSlashCommands } from '../components/SlashCommands'
import { usePresence } from '../components/presence'
import ReplyPreview from '../components/ReplyPreview'
import RunAction from '../components/RunAction'
import RunEnded from '../components/RunEnded'
import RunStatus from '../components/RunStatus'
import Spinner from '../components/Spinner'
import ThreadAsk from '../components/ThreadAsk'
import ThreadItems from '../components/ThreadItems'
import { ownsMenu, useThreadMenu } from '../components/threadMenu'
import Tooltip from '../components/Tooltip'
import { selecting } from '../components/selecting'
import {
  buildThread,
  eventsOfThread,
  lastEnd,
  lastStart,
  threadAsk,
  THREAD_STATE_LABELS,
  threadState,
  type ThreadItem
} from '../components/thread'
import { useThreadRead } from '../components/useThreadRead'
import { useFamilySteps } from '../components/useThreadSteps'
import { useAutoResize } from '../components/useAutoResize'
import { useComposerRoom } from '../components/useComposerRoom'
import { useDrawnTail } from '../components/useDrawnTail'
import { useFindQuery } from '../components/find'
import { useStickToBottom } from '../components/useStickToBottom'
import { commandTyped, threadCommands, type CommandName } from '../../../shared/commands'
import { mentionsIn } from '../../../shared/llm'
import { ArchiveGlyph, CheckGlyph, ChevronLeftGlyph, CloseGlyph, EyeGlyph, StopGlyph, WarningGlyph } from '../icons'
import { pendingCount, useCrew } from '../state/store'
import { useMessagePlugin } from '../state/messagePlugin'
import { toast } from '../state/toast'
import { activityForAgent } from '../components/agentActivity'

const BACK_WIDTH = 40
const AVATAR_WIDTH = 52
const NAME_MIN_WIDTH = 96
// A few words of the ask or none of it. Truncated past this the line is one
// word and an ellipsis, which says less than the space it takes.
const ASK_MIN_WIDTH = 180
// Under this the status word, the button beside it and the two marks at the end
// of the row leave the name nothing at all, so the word goes and its mark stands
// in for it.
const TIGHT_ROW = 460
const THREAD_PAGE = 400
const EMPTY_COMMANDS: CommandName[] = []

export default function ThreadView({
  threadId,
  many = false,
  focused = true,
  alone = false,
  personal = false
}: {
  threadId: string
  many?: boolean
  focused?: boolean
  alone?: boolean
  personal?: boolean
}) {
  const { events, steps } = useThreadRead(threadId)
  const selfId = useCrew(s => s.selfId)
  const thread = useCrew(s => s.threads[threadId])
  const agentActivity = useCrew(s => {
    const promptId = s.threadPrompts[threadId]
    return activityForAgent(promptId ? [promptId] : undefined, s.steps)
  })
  const activePromptId = useCrew(s => s.threadPrompts[threadId])
  const tokens = useCrew(s => (activePromptId ? (s.tokens[activePromptId] ?? 0) : 0))
  const cost = useCrew(s => (activePromptId ? s.costs[activePromptId] : undefined))
  const sendChat = useCrew(s => s.sendChat)
  const implementPlan = useCrew(s => s.implementPlan)
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const setThreadStatus = useCrew(s => s.setThreadStatus)
  const removeQueued = useCrew(s => s.removeQueued)
  const sendQueued = useCrew(s => s.sendQueued)
  const takeQueued = useCrew(s => s.takeQueued)
  const moveQueued = useCrew(s => s.moveQueued)
  const queueComposed = useCrew(s => s.queueComposed[threadId])
  const clearQueueComposed = useCrew(s => s.clearQueueComposed)
  const closeThread = useCrew(s => s.closeThread)
  const focusThread = useCrew(s => s.focusThread)
  const text = useCrew(s => s.threadDrafts[threadId] ?? '')
  const setThreadDraft = useCrew(s => s.setThreadDraft)
  const agents = useCrew(s => s.agents)
  const [replyTo, setReplyTo] = useState<ThreadItem | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const { scrolledUp, atBottom, onScroll, jumpToBottom, jumpToTop, follow } = useStickToBottom(
    scrollRef,
    `thread:${threadId}`
  )
  const inputRef = useAutoResize(text, COMPOSER_MAX)
  const agentPresence = usePresence(thread?.agentLabel ?? '', thread?.agentId)
  const onReply = useCallback(
    (item: ThreadItem) => {
      setReplyTo(item)
      inputRef.current?.focus()
    },
    [inputRef]
  )

  useEffect(() => {
    if (!queueComposed) return
    const reply = queueComposed.replyTo
    setReplyTo(
      reply
        ? {
            key: reply.targetId,
            ts: 0,
            kind: 'message',
            author: reply.authorName,
            authorId: reply.authorId,
            self: reply.authorId === selfId,
            text: reply.text,
            streaming: false,
            reactionTargetId: reply.targetId
          }
        : null
    )
    clearQueueComposed(threadId)
    inputRef.current?.focus({ preventScroll: true })
  }, [clearQueueComposed, inputRef, queueComposed, selfId, threadId])

  const threadEvents = useMemo(() => eventsOfThread(events, threadId), [events, threadId])
  const runningStart = useMemo(() => lastStart(threadEvents, activePromptId), [activePromptId, threadEvents])
  const ended = useMemo(() => lastEnd(threadId, threadEvents), [threadEvents, threadId])
  const runningAgentId = runningStart?.agentId
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

  const mention = useMentionAutocomplete(text, write, inputRef, { commands: offered })
  const slash = useSlashCommands(text, write, takeCommand, inputRef, offered)
  const items = useMemo(() => buildThread(threadEvents, steps, selfId, agents), [threadEvents, steps, selfId, agents])
  const finding = useFindQuery() !== ''
  const tail = useDrawnTail(items.length, THREAD_PAGE, scrollRef, scrolledUp || finding)
  const drawn = useMemo(() => (tail.from === 0 ? items : items.slice(tail.from)), [items, tail.from])
  const drawWhole = tail.drawWhole
  useEffect(() => {
    if (finding) drawWhole()
  }, [finding, drawWhole])
  const heading = useRef(false)
  const reachTop = useCallback(() => {
    if (!tail.more) {
      jumpToTop()
      return
    }
    heading.current = true
    drawWhole()
  }, [drawWhole, jumpToTop, tail.more])
  useLayoutEffect(() => {
    if (!heading.current || tail.more) return
    heading.current = false
    const el = scrollRef.current
    if (el) el.scrollTop = 0
    jumpToTop()
  }, [jumpToTop, tail.more])
  const tailScroll = tail.onScroll
  const scrolled = useCallback(() => {
    onScroll()
    tailScroll()
  }, [onScroll, tailScroll])
  // The message the thread was opened on. The header holds the host's own short
  // name for it, and this is what the whole of it reads as.
  const opening = useMemo(() => items.find(item => item.kind === 'message'), [items])
  const threadSteps = useFamilySteps(threadId)
  const queueItems = useCrew(s => s.queues[threadId])
  const queuedMessages = useMemo<QueuedMessage[]>(
    () =>
      (queueItems ?? []).map(item => {
        const label = agents.find(a => a.id === item.agentId)?.label ?? item.agentLabel
        return {
          promptId: item.promptId,
          author: item.authorName,
          self: item.authorId === selfId,
          sendable: Boolean(activePromptId) && steerable && item.agentId === runningAgentId,
          text: item.text,
          agentLabel: item.agentId !== thread?.agentId ? label : undefined,
          attachments: item.attachments,
          replyTo: item.replyTo
        }
      }),
    [activePromptId, agents, queueItems, runningAgentId, selfId, steerable, thread?.agentId]
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

  const { ref: overlayRef, room } = useComposerRoom()
  const [headerRow, setHeaderRow] = useState<HTMLDivElement | null>(null)
  const [headerStatus, setHeaderStatus] = useState<HTMLDivElement | null>(null)
  const [nameWidth, setNameWidth] = useState(Number.POSITIVE_INFINITY)
  const [rowWidth, setRowWidth] = useState(Number.POSITIVE_INFINITY)

  useEffect(() => {
    if (!headerRow || !headerStatus) return
    const measure = () => {
      const style = getComputedStyle(headerRow)
      const gap = parseFloat(style.columnGap) || 0
      const inner = headerRow.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      setRowWidth(inner)
      setNameWidth(inner - BACK_WIDTH - headerStatus.offsetWidth - gap * 2)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(headerRow)
    observer.observe(headerStatus)
    return () => observer.disconnect()
  }, [headerRow, headerStatus])

  useLayoutEffect(() => {
    follow()
  }, [items, room, follow])

  const send = () => {
    if (!text.trim() && pendingCount(threadId) === 0) return
    // A question on the side is answered in the panel and a fork carries on in a
    // thread of its own. Neither lands here, so neither is a reply to anything in
    // this thread and neither is anything to scroll down to.
    const elsewhere = command === 'btw' || command === 'fork'
    sendChat(
      text,
      threadId,
      undefined,
      elsewhere ? undefined : replyTo?.reactionTargetId,
      undefined,
      command ? [command] : undefined,
      useMessagePlugin.getState().picked[threadId]
    )
    useMessagePlugin.getState().taken(threadId)
    setReplyTo(null)
    mention.close()
    slash.close()
    if (!elsewhere) jumpToBottom()
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

  const openMenu = useThreadMenu({
    threadId,
    status: true,
    opening: !alone,
    windowPin: true,
    onOpen: () => focusThread(threadId)
  })
  const onBackground = (event: React.MouseEvent) => {
    if (selecting() || ownsMenu(event.target)) return
    openMenu.onContextMenu(event)
  }

  if (!thread) return null

  const ask = threadAsk(thread, agents)
  const showPet = nameWidth >= AVATAR_WIDTH + NAME_MIN_WIDTH
  // A column at its narrowest cannot hold the state twice. The mark says it and
  // the word goes, since what is left in the row is the one thing there to press
  // and the name of who the thread is with.
  const tight = rowWidth < TIGHT_ROW
  const placeholder =
    command === 'btw'
      ? 'Ask about this thread, off to the side'
      : command === 'fork'
        ? 'Carry on from here'
        : 'Send a message or @ someone'
  const state = threadState(thread, threadEvents, Boolean(activePromptId))
  const statusAction =
    thread.status === 'open'
      ? { label: 'Mark done', to: 'done' as const }
      : { label: thread.status === 'done' ? 'Reopen' : 'Unarchive', to: 'open' as const }
  const editQueuedMessage = (promptId: string) => {
    if (text.trim() || pendingCount(threadId) > 0 || replyTo) {
      toast('Finish the message in the composer first.', { key: `queue-compose-${threadId}` })
      inputRef.current?.focus({ preventScroll: true })
      return
    }
    takeQueued(promptId)
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 min-w-0 relative">
        <FindBar containerRef={contentRef} scrollerRef={scrollRef} placeholder="Find in thread" listens={focused} />
        <div
          ref={scrollRef}
          onScroll={scrolled}
          onContextMenu={onBackground}
          className="h-full overflow-y-auto overflow-x-hidden px-6"
        >
          <div
            ref={contentRef}
            className="max-w-[660px] mx-auto space-y-5"
            style={{ paddingTop: 'var(--page-rest)', paddingBottom: room }}
          >
            {thread.forkedFrom && !tail.more && <ForkedFrom threadId={thread.forkedFrom} />}
            <ThreadItems threadId={threadId} items={drawn} onReply={onReply} />
            {activePromptId && startedAt ? (
              <RunStatus startedAt={startedAt} tokens={tokens} cost={cost} steps={steps[activePromptId] ?? []} />
            ) : (
              ended && (
                <div className="space-y-3">
                  <RunEnded end={ended} />
                  {thread.mode === 'plan' && thread.plan && (
                    <RunAction label="Implement plan" onClick={() => implementPlan(threadId)} solid />
                  )}
                </div>
              )
            )}
            {!personal && <FilesChanged steps={threadSteps} agentId={thread.agentId} />}
          </div>
        </div>

        <div ref={overlayRef} className="absolute inset-x-0 bottom-0 pointer-events-none">
          <div
            className={`h-14 bg-gradient-to-t from-ink-900 to-transparent transition-opacity duration-200 ${atBottom ? 'opacity-0' : 'opacity-100'}`}
          />
          <div className="bg-ink-900 px-6 pb-6">
            <div className="relative max-w-[660px] mx-auto pointer-events-auto">
              {scrolledUp &&
                (diffTotals.files > 0 ? (
                  <ThreadJumps
                    files={diffTotals.files}
                    added={diffTotals.added}
                    removed={diffTotals.removed}
                    onClick={jumpToBottom}
                  />
                ) : (
                  <JumpToBottom onClick={jumpToBottom} />
                ))}
              {!personal && (
                <QueueBar
                  items={queuedMessages}
                  onEdit={editQueuedMessage}
                  onRemove={removeQueued}
                  onSend={sendQueued}
                  onMove={moveQueued}
                />
              )}
              {replyTo && <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />}
              {thread.ghost && <GhostBar />}
              {!personal && (
                <div
                  className={`relative bg-ink-900 border border-b-0 border-ink-700 rounded-t-[30px] pb-12 -mb-9 ${
                    thread.ghost ? 'border-dashed' : ''
                  }`}
                >
                  <div ref={setHeaderRow} className="flex items-center gap-3 px-3 pt-2.5">
                    {!alone && (
                      <Tooltip label={many ? 'Close' : 'Back to chat'}>
                        <button
                          onClick={() => closeThread(threadId)}
                          aria-label={many ? 'Close' : 'Back to chat'}
                          className="w-10 h-10 rounded-full bg-ink-800 text-fg-secondary flex items-center justify-center transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95 shrink-0"
                        >
                          {many ? <CloseGlyph className="w-5 h-5" /> : <ChevronLeftGlyph className="w-5 h-5" />}
                        </button>
                      </Tooltip>
                    )}
                    {/* Who the thread is with, and what it is about. The ask is
                      the thread's own name for itself and the one thing this row
                      could not say, so it stands under the agent's name and
                      starts where it starts. Pressing it goes to the head of the
                      thread, where the whole of it is written.

                      The pair is the height the row already was: the ramp sets a
                      base line at 22 and a small one at 18, which is the 40 the
                      pet and the way back are drawn at, so the two lines are
                      centered on the mark beside them by the leading alone. The
                      mark stands out here rather than inside the name, or line
                      one is 40 on its own and the row grows by the second. */}
                    {showPet && <AgentIcon seed={thread.agentId} presence={agentPresence} activity={agentActivity} />}
                    {/* A column of two rather than two lines in one box: an inline
                      box carries the strut of a line it has no text for, and the
                      few pixels a descender leaves under the name are what would
                      push the pair past the 40 the row is drawn at. */}
                    <div className="min-w-0 flex-1 flex flex-col items-start">
                      <MemberName id={thread.agentId} name={thread.agentLabel} className="min-w-0 max-w-full">
                        <span className="block text-base font-bold text-fg truncate cursor-default">
                          {thread.agentLabel}
                        </span>
                      </MemberName>
                      {ask && nameWidth >= ASK_MIN_WIDTH && (
                        <ThreadAsk
                          ask={ask}
                          whole={opening?.text}
                          mentionRefs={opening?.mentionRefs}
                          onJump={reachTop}
                        />
                      )}
                    </div>
                    <div ref={setHeaderStatus} className="ml-auto flex items-center gap-2 shrink-0">
                      {/* Why the answers here are one line each. Without it the
                        thread reads as an agent being terse for no reason. */}
                      {state === 'working' ? (
                        <>
                          <Spinner size={16} className="text-fg" />
                          {!tight && <span className="text-base font-semibold text-fg">Working</span>}
                        </>
                      ) : (
                        <>
                          <Tooltip label={THREAD_STATE_LABELS[state]} disabled={!tight}>
                            <span className="flex items-center">
                              {state === 'done' && <CheckGlyph className="w-5 h-5 text-fg" />}
                              {state === 'ready' && <EyeGlyph className="w-5 h-5 text-fg" />}
                              {state === 'failed' && <WarningGlyph className="w-5 h-5 text-danger" />}
                              {state === 'stopped' && <StopGlyph className="w-5 h-5 text-fg-muted" />}
                              {state === 'archived' && <ArchiveGlyph className="w-5 h-5 text-fg-muted" />}
                            </span>
                          </Tooltip>
                          {!tight && (
                            <span
                              className={`text-base font-semibold ${state === 'failed' ? 'text-danger' : 'text-fg'}`}
                            >
                              {THREAD_STATE_LABELS[state]}
                            </span>
                          )}
                          <button
                            onClick={() => setThreadStatus(threadId, statusAction.to)}
                            className="ml-1 h-10 px-4 rounded-full bg-ink-800 text-sm font-semibold text-fg-secondary transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95"
                          >
                            {statusAction.label}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                  commands={offered}
                  onCommand={takeCommand}
                  sendLabel={
                    command === 'btw'
                      ? 'Ask'
                      : command === 'fork'
                        ? 'Fork'
                        : canSteer && command !== 'queue'
                          ? 'Steer'
                          : 'Send'
                  }
                  ghost={thread.ghost}
                  chips={command && <CommandChip name={command} onRemove={() => setThreadCommands(threadId, [])} />}
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
                <TypingLine where={threadId} />
              </div>
            </div>
          </div>
        </div>
        {openMenu.menu}
      </div>
    </div>
  )
}
