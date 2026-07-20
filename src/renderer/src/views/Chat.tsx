import { useEffect, useMemo, useRef, useState } from 'react'
import type { SessionEvent } from '../../../shared/events'
import Avatar from '../components/Avatar'
import Markdown from '../components/Markdown'
import { formatTime } from '../components/time'
import { useCrew } from '../state/store'

interface ThreadItem {
  key: string
  ts: number
  kind: 'message' | 'reply' | 'note'
  author: string
  self: boolean
  text: string
  streaming: boolean
  promptId?: string
  agentId?: string
  error?: string
}

function buildThread(events: SessionEvent[], streams: Record<string, string>, selfId: string): ThreadItem[] {
  const ended = new Set(events.filter(e => e.kind === 'agent.end').map(e => e.promptId))
  const items: ThreadItem[] = []
  for (const event of events) {
    if (event.kind === 'message') {
      items.push({
        key: event.id,
        ts: event.ts,
        kind: event.authorId === 'crew' ? 'note' : 'message',
        author: event.authorName,
        self: event.authorId === selfId,
        text: event.text,
        streaming: false
      })
    }
    if (event.kind === 'agent.start' && !ended.has(event.promptId)) {
      items.push({
        key: event.id,
        ts: event.ts,
        kind: 'reply',
        author: event.agentLabel,
        self: false,
        text: streams[event.promptId] ?? '',
        streaming: true,
        promptId: event.promptId,
        agentId: event.agentId
      })
    }
    if (event.kind === 'agent.end') {
      items.push({
        key: event.id,
        ts: event.ts,
        kind: 'reply',
        author: event.agentLabel,
        self: false,
        text: event.ok ? (event.text ?? '') : (event.error ?? 'Something went wrong.'),
        streaming: false,
        error: event.ok ? undefined : (event.error ?? 'error')
      })
    }
  }
  return items
}

export default function Chat() {
  const events = useCrew(s => s.events)
  const streams = useCrew(s => s.streams)
  const selfId = useCrew(s => s.selfId)
  const agents = useCrew(s => s.agents)
  const sendChat = useCrew(s => s.sendChat)
  const cancelPrompt = useCrew(s => s.cancelPrompt)

  const [text, setText] = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => buildThread(events, streams, selfId), [events, streams, selfId])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [items, streams])

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return []
    const query = mentionQuery.toLowerCase()
    return agents.filter(a => a.status !== 'offline' && a.label.toLowerCase().startsWith(query)).slice(0, 5)
  }, [agents, mentionQuery])

  const onChange = (value: string) => {
    setText(value)
    const caret = inputRef.current?.selectionStart ?? value.length
    const match = /(?:^|\s)@([^\s@]*)$/.exec(value.slice(0, caret))
    setMentionQuery(match ? match[1] : null)
  }

  const pickMention = (label: string) => {
    const caret = inputRef.current?.selectionStart ?? text.length
    const before = text.slice(0, caret).replace(/@[^\s@]*$/, `@${label} `)
    setText(before + text.slice(caret))
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  const send = () => {
    if (!text.trim()) return
    sendChat(text)
    setText('')
    setMentionQuery(null)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (mentionMatches.length > 0) pickMention(mentionMatches[0].label)
      else send()
    }
  }

  const activityFor = (agentId?: string) => {
    if (!agentId) return ''
    const agent = agents.find(a => a.id === agentId)
    const running = agent?.activities.filter(a => a.status === 'running') ?? []
    return running.map(a => a.name).join(', ')
  }

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {items.length === 0 && (
          <p className="text-sm text-zinc-500 mt-8 text-center">Say hi, or mention an agent with @ to put it to work.</p>
        )}
        <div className="max-w-3xl mx-auto space-y-5">
          {items.map(item =>
            item.kind === 'note' ? (
              <p key={item.key} className="text-xs text-zinc-500 text-center">
                {item.text}
              </p>
            ) : (
              <div key={item.key} className="flex gap-3">
                <Avatar name={item.author} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-zinc-100">
                      {item.self ? `${item.author} (you)` : item.author}
                    </span>
                    <span className="text-[11px] text-zinc-500">{formatTime(item.ts)}</span>
                    {item.streaming && (
                      <button
                        onClick={() => item.promptId && cancelPrompt(item.promptId)}
                        className="text-[11px] text-zinc-400 hover:text-white"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                  {item.streaming && activityFor(item.agentId) && (
                    <p className="text-xs text-zinc-500 mt-0.5">Working: {activityFor(item.agentId)}</p>
                  )}
                  {item.kind === 'reply' ? (
                    <div className={item.error ? 'text-sm text-red-400 mt-1' : 'mt-1'}>
                      {item.error ? item.text : <Markdown text={item.text || '…'} />}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap mt-1">{item.text}</p>
                  )}
                  {item.streaming && <span className="inline-block w-2 h-4 bg-zinc-500 animate-pulse mt-1" />}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto relative">
          {mentionMatches.length > 0 && (
            <div className="absolute bottom-full mb-2 left-0 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden min-w-48">
              {mentionMatches.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => pickMention(agent.label)}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 flex items-center justify-between gap-4"
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
              placeholder="Message the crew. Use @ to mention an agent."
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
