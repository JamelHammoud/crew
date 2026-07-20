import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { mentionCandidates } from '../../../shared/llm'
import Avatar from '../components/Avatar'
import ChatMessage from '../components/ChatMessage'
import Composer from '../components/Composer'
import ThreadCard from '../components/ThreadCard'
import { describeStep, type ThreadItem } from '../components/thread'
import { formatElapsed, formatTokens } from '../components/time'
import { useAutoResize } from '../components/useAutoResize'
import { useNow } from '../components/useNow'
import { CHAT_KEY, useCrew, type ThreadMeta } from '../state/store'

type Feed =
  | { kind: 'msg'; key: string; item: ThreadItem }
  | { kind: 'card'; key: string; ts: number; thread: ThreadMeta }

export default function Chat() {
  const events = useCrew(s => s.events)
  const selfId = useCrew(s => s.selfId)
  const agents = useCrew(s => s.agents)
  const threads = useCrew(s => s.threads)
  const threadPrompts = useCrew(s => s.threadPrompts)
  const steps = useCrew(s => s.steps)
  const tokens = useCrew(s => s.tokens)
  const sendChat = useCrew(s => s.sendChat)
  const openThread = useCrew(s => s.openThread)
  const text = useCrew(s => s.chatDraft)
  const setChatDraft = useCrew(s => s.setChatDraft)
  const pendingCount = useCrew(s => (s.pending[CHAT_KEY] ?? []).length)

  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [activeMention, setActiveMention] = useState(0)
  const inputRef = useAutoResize(text)
  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
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
      if (e.kind === 'thread.started' && threads[e.threadId]) {
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
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [feed, steps, threadPrompts])

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

  const mentionMatches = useMemo(() => mentionCandidates(agents, mentionQuery), [agents, mentionQuery])
  const activeIndex = Math.min(activeMention, Math.max(mentionMatches.length - 1, 0))

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const onChange = (value: string) => {
    setChatDraft(value)
    const caret = inputRef.current?.selectionStart ?? value.length
    const match = /(?:^|\s)@([^@]*)$/.exec(value.slice(0, caret))
    setMentionQuery(match ? match[1] : null)
    setActiveMention(0)
  }

  const pickMention = (label: string) => {
    const caret = inputRef.current?.selectionStart ?? text.length
    const before = text.slice(0, caret).replace(/@[^@]*$/, `@${label} `)
    setChatDraft(before + text.slice(caret))
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  const send = () => {
    if (!text.trim() && pendingCount === 0) return
    sendChat(text)
    setMentionQuery(null)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mentionMatches.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const delta = e.key === 'ArrowDown' ? 1 : -1
        setActiveMention((activeIndex + delta + mentionMatches.length) % mentionMatches.length)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        pickMention(mentionMatches[activeIndex].label)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="h-full relative">
      <div ref={scrollRef} className="h-full overflow-y-auto px-6">
        <div className="max-w-[660px] mx-auto pt-28 pb-48 space-y-8">
          {feed.length === 0 && (
            <p className="text-base text-fg-muted mt-16 text-center">
              Say hi, or mention an agent with @ to start a thread.
            </p>
          )}
          {feed.map(entry =>
            entry.kind === 'card' ? (
              <ThreadCard
                key={entry.key}
                thread={entry.thread}
                ts={entry.ts}
                onOpen={() => openThread(entry.thread.id)}
                {...threadStatus(entry.thread)}
              />
            ) : (
              <ChatMessage key={entry.key} item={entry.item} />
            )
          )}
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
              onChange={onChange}
              onKeyDown={onKeyDown}
              onSend={send}
            >
              {mentionMatches.length > 0 && (
                <div
                  ref={listRef}
                  className="glass absolute bottom-full mb-2 left-0 rounded-2xl p-1.5 min-w-64 max-h-56 overflow-y-auto animate-pop z-50"
                >
                  {mentionMatches.map((agent, index) => {
                    const status = agents.find(a => a.id === agent.id)?.status
                    return (
                      <button
                        key={agent.id}
                        onClick={() => pickMention(agent.label)}
                        onMouseEnter={() => setActiveMention(index)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
                          index === activeIndex ? 'bg-white/[0.08] text-fg' : 'text-fg-secondary'
                        }`}
                      >
                        <Avatar name={agent.label} size="sm" presence={status === 'offline' ? 'offline' : 'online'} />
                        <span className="flex-1 truncate">@{agent.label}</span>
                        <span className="text-xs text-fg-muted shrink-0">{agent.ownerName}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Composer>
          </div>
        </div>
      </div>
    </div>
  )
}
