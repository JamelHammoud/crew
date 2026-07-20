import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { mentionCandidates } from '../../../shared/llm'
import { AttachButton, AttachmentTray } from '../components/Attachments'
import ChatMessage from '../components/ChatMessage'
import ThreadCard from '../components/ThreadCard'
import { describeStep, type ThreadItem } from '../components/thread'
import { formatElapsed, formatTokens } from '../components/time'
import { useAutoResize } from '../components/useAutoResize'
import { useNow } from '../components/useNow'
import { CHAT_KEY, useCrew, type ThreadMeta } from '../state/store'

type Feed =
  | { kind: 'msg'; key: string; item: ThreadItem }
  | { kind: 'card'; key: string; thread: ThreadMeta }

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
  const attach = useCrew(s => s.attach)
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
        list.push({ kind: 'card', key: e.id, thread: threads[e.threadId] })
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
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {feed.length === 0 && (
          <p className="text-sm text-zinc-500 mt-8 text-center">
            Say hi, or mention an agent with @ to start a thread.
          </p>
        )}
        <div className="max-w-3xl mx-auto space-y-5">
          {feed.map(entry =>
            entry.kind === 'card' ? (
              <ThreadCard
                key={entry.key}
                thread={entry.thread}
                onOpen={() => openThread(entry.thread.id)}
                {...threadStatus(entry.thread)}
              />
            ) : (
              <ChatMessage key={entry.key} item={entry.item} />
            )
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto relative">
          {mentionMatches.length > 0 && (
            <div
              ref={listRef}
              className="absolute bottom-full mb-2 left-0 bg-zinc-900 border border-zinc-800 rounded-lg min-w-48 max-h-56 overflow-y-auto"
            >
              {mentionMatches.map((agent, index) => (
                <button
                  key={agent.id}
                  onClick={() => pickMention(agent.label)}
                  onMouseEnter={() => setActiveMention(index)}
                  className={`w-full text-left px-3 py-2 text-sm text-zinc-200 flex items-center justify-between gap-4 ${
                    index === activeIndex ? 'bg-zinc-800' : ''
                  }`}
                >
                  <span>@{agent.label}</span>
                  <span className="text-xs text-zinc-500">{agent.ownerName}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Message the crew. Use @ to start an agent thread."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 resize-none"
            />
            <button
              onClick={send}
              className="bg-white text-black rounded-lg px-4 py-2 text-sm font-medium hover:bg-zinc-200 shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
