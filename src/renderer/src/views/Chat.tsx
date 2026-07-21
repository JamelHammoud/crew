import { Fragment, useLayoutEffect, useMemo, useRef } from 'react'
import ChatMessage from '../components/ChatMessage'
import Composer from '../components/Composer'
import DayDivider from '../components/DayDivider'
import { hoverCardOpen } from '../components/HoverCard'
import { MentionMenu, useMentionAutocomplete } from '../components/MentionAutocomplete'
import ThreadCard from '../components/ThreadCard'
import { describeStep, type ThreadItem } from '../components/thread'
import { formatElapsed, formatTokens, isNewDay } from '../components/time'
import { useAutoResize } from '../components/useAutoResize'
import { useNow } from '../components/useNow'
import { useStickToBottom } from '../components/useStickToBottom'
import { CHAT_KEY, useCrew, type ThreadMeta } from '../state/store'

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

  const inputRef = useAutoResize(text)
  const mention = useMentionAutocomplete(text, setChatDraft, inputRef)
  const scrollRef = useRef<HTMLDivElement>(null)
  const didInitialScroll = useRef(false)
  const working = Object.keys(threadPrompts).length > 0
  const now = useNow(working)

  const feed = useMemo<Feed[]>(() => {
    const list: Feed[] = []
    for (const e of events) {
      if (e.kind === 'message' && !e.threadId) {
        list.push({
          kind: 'msg',
          key: e.id,
          item: {
            key: e.id,
            ts: e.ts,
            kind: e.authorId === 'crew' ? 'note' : 'message',
            author: e.authorName,
            self: e.authorId === selfId,
            text: e.text,
            streaming: false,
            attachments: e.attachments
          }
        })
      }
      if (e.kind === 'thread.started' && threads[e.threadId] && !threads[e.threadId].archived) {
        list.push({ kind: 'card', key: e.id, ts: e.ts, thread: threads[e.threadId] })
      }
    }
    return list
  }, [events, threads, selfId])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!didInitialScroll.current) {
      if (feed.length === 0) return
      didInitialScroll.current = true
      el.scrollTop = el.scrollHeight
      return
    }
    if (pinnedRef.current && !hoverCardOpen()) el.scrollTop = el.scrollHeight
  }, [feed, steps, threadPrompts, pinnedRef])

  const threadStatus = (thread: ThreadMeta): { working: boolean; status: string } => {
    const promptId = threadPrompts[thread.id]
    if (promptId) {
      const start = events.find(e => e.kind === 'agent.start' && e.promptId === promptId)
      const parts = [describeStep((steps[promptId] ?? []).at(-1))]
      if (start) parts.push(formatElapsed(now - start.ts))
      const count = tokens[promptId] ?? 0
      if (count > 0) parts.push(`${formatTokens(count)} tokens`)
      return { working: true, status: parts.join(' · ') }
    }
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]
      if (e.kind === 'agent.end' && e.threadId === thread.id) {
        const reply = e.ok ? (e.text ?? '') : (e.error ?? '')
        const preview = reply.replace(/\s+/g, ' ').trim().slice(0, 70)
        return { working: false, status: preview || 'Done' }
      }
    }
    return { working: false, status: 'Done' }
  }

  const send = () => {
    if (!text.trim() && pendingCount === 0) return
    sendChat(text)
    mention.close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
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
                  <ThreadCard
                    thread={entry.thread}
                    ts={entry.ts}
                    onOpen={() => openThread(entry.thread.id)}
                    {...threadStatus(entry.thread)}
                  />
                ) : (
                  <ChatMessage item={entry.item} />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 pointer-events-none">
        <div className="h-14 bg-gradient-to-t from-ink-900 to-transparent" />
        <div className="bg-ink-900 px-6 pb-6">
          <div className="max-w-[660px] mx-auto pointer-events-auto">
            <Composer
              attachmentKey={CHAT_KEY}
              value={text}
              placeholder="Send a message or @ an agent to start a thread"
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
            </Composer>
          </div>
        </div>
      </div>
    </div>
  )
}
