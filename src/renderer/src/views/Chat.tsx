import { Fragment, useLayoutEffect, useMemo, useRef } from 'react'
import ChatMessage from '../components/ChatMessage'
import Composer from '../components/Composer'
import DayDivider from '../components/DayDivider'
import JumpToBottom from '../components/JumpToBottom'
import { MentionMenu, useMentionAutocomplete } from '../components/MentionAutocomplete'
import PlanCard from '../components/PlanCard'
import { SlashMenu, useSlashCommands } from '../components/SlashCommands'
import ThreadCard from '../components/ThreadCard'
import { describeStep, endPreview, lastEnd, threadState, type ThreadItem, type ThreadState } from '../components/thread'
import { reactionGroups } from '../components/reactionGroups'
import { formatElapsed, formatTokens, isNewDay } from '../components/time'
import { useAutoResize } from '../components/useAutoResize'
import { useNow } from '../components/useNow'
import { useStickToBottom } from '../components/useStickToBottom'
import { CHAT_KEY, useCrew, type ThreadMeta } from '../state/store'
import { messageReactionTarget } from '../../../shared/reactions'

type Feed =
  | { kind: 'msg'; key: string; item: ThreadItem }
  | { kind: 'card'; key: string; ts: number; thread: ThreadMeta }

export default function Chat() {
  const events = useCrew(s => s.events)
  const selfId = useCrew(s => s.selfId)
  const threads = useCrew(s => s.threads)
  const threadPrompts = useCrew(s => s.threadPrompts)
  const steps = useCrew(s => s.steps)
  const tokens = useCrew(s => s.tokens)
  const sendChat = useCrew(s => s.sendChat)
  const openThread = useCrew(s => s.openThread)
  const text = useCrew(s => s.chatDraft)
  const setChatDraft = useCrew(s => s.setChatDraft)
  const pendingCount = useCrew(s => (s.pending[CHAT_KEY] ?? []).length)
  const agents = useCrew(s => s.agents)

  const inputRef = useAutoResize(text)
  const mention = useMentionAutocomplete(text, setChatDraft, inputRef)
  const slash = useSlashCommands(text, setChatDraft, inputRef)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrolledUp, onScroll, jumpToBottom, follow } = useStickToBottom(scrollRef, CHAT_KEY)
  const working = Object.keys(threadPrompts).length > 0
  const now = useNow(working)

  const feed = useMemo<Feed[]>(() => {
    const list: Feed[] = []
    const reactions = reactionGroups(events, selfId)
    for (const e of events) {
      if (e.kind === 'message' && !e.threadId) {
        const targetId = messageReactionTarget(e.id)
        list.push({
          kind: 'msg',
          key: e.id,
          item: {
            key: e.id,
            ts: e.ts,
            kind: e.authorId === 'crew' ? 'note' : 'message',
            author: agents.find(a => a.id === e.authorId)?.label ?? e.authorName,
            authorId: e.authorId,
            self: e.authorId === selfId,
            text: e.text,
            streaming: false,
            attachments: e.attachments,
            mentionRefs: e.mentionRefs,
            docMentions: e.docMentions,
            reactionTargetId: e.authorId === 'crew' ? undefined : targetId,
            reactions: e.authorId === 'crew' ? undefined : reactions.get(targetId)
          }
        })
      }
      if (e.kind === 'thread.started' && threads[e.threadId]?.status === 'open') {
        list.push({ kind: 'card', key: e.id, ts: e.ts, thread: threads[e.threadId] })
      }
    }
    return list
  }, [agents, events, threads, selfId])

  useLayoutEffect(() => {
    follow(feed.length > 0)
  }, [feed, steps, threadPrompts, follow])

  const threadStatus = (thread: ThreadMeta): { state: ThreadState; detail: string } => {
    const promptId = threadPrompts[thread.id]
    if (promptId) {
      const start = events.find(e => e.kind === 'agent.start' && e.promptId === promptId)
      const parts = [describeStep((steps[promptId] ?? []).at(-1))]
      if (start) parts.push(formatElapsed(now - start.ts))
      const count = tokens[promptId] ?? 0
      if (count > 0) parts.push(`${formatTokens(count)} tokens`)
      return { state: 'working', detail: parts.join(' · ') }
    }
    return { state: threadState(thread, events, false), detail: endPreview(lastEnd(thread.id, events)) }
  }

  const send = () => {
    if (!text.trim() && pendingCount === 0) return
    sendChat(text)
    mention.close()
    slash.close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (slash.onKeyDown(e)) return
    if (mention.onKeyDown(e)) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="h-full relative">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-6">
        <div className="max-w-[660px] mx-auto pt-28 pb-48 space-y-8">
          {feed.length === 0 && (
            <p className="text-base text-fg-muted mt-16 text-center">
              Say hi, or mention an agent with @ to start a thread.
            </p>
          )}
          {feed.map((entry, index) => {
            const tsOf = (e: Feed) => (e.kind === 'card' ? e.ts : e.item.ts)
            const ts = tsOf(entry)
            const prev = index > 0 ? tsOf(feed[index - 1]) : undefined
            return (
              <Fragment key={entry.key}>
                {isNewDay(prev, ts) && <DayDivider ts={ts} />}
                {entry.kind === 'card' ? (
                  entry.thread.mode === 'plan' && entry.thread.plan && !threadPrompts[entry.thread.id] ? (
                    <PlanCard thread={entry.thread} ts={entry.ts} onOpen={() => openThread(entry.thread.id)} />
                  ) : (
                    <ThreadCard
                      thread={entry.thread}
                      ts={entry.ts}
                      onOpen={() => openThread(entry.thread.id)}
                      {...threadStatus(entry.thread)}
                    />
                  )
                ) : (
                  <ChatMessage item={entry.item} editable />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 pointer-events-none">
        <div className="h-14 bg-gradient-to-t from-ink-900 to-transparent" />
        <div className="bg-ink-900 px-6 pb-6">
          <div className="relative max-w-[660px] mx-auto pointer-events-auto">
            {scrolledUp && <JumpToBottom onClick={jumpToBottom} />}
            <Composer
              attachmentKey={CHAT_KEY}
              value={text}
              placeholder="Send a message, @ an agent to start a thread, or / for a command"
              inputRef={inputRef}
              onChange={mention.onChange}
              onKeyDown={onKeyDown}
              onSend={send}
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
  )
}
