import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import ChatMessage from '../components/ChatMessage'
import { buildThread } from '../components/thread'
import { useCrew } from '../state/store'

export default function ThreadView({ threadId }: { threadId: string }) {
  const events = useCrew(s => s.events)
  const streams = useCrew(s => s.streams)
  const selfId = useCrew(s => s.selfId)
  const thread = useCrew(s => s.threads[threadId])
  const activePromptId = useCrew(s => s.threadPrompts[threadId])
  const activities = useCrew(s => s.threadActivities[threadId])
  const sendChat = useCrew(s => s.sendChat)
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const closeThread = useCrew(s => s.closeThread)

  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const threadEvents = useMemo(() => events.filter(e => 'threadId' in e && e.threadId === threadId), [events, threadId])
  const items = useMemo(() => buildThread(threadEvents, streams, selfId), [threadEvents, streams, selfId])
  const acts = (activities ?? []).slice(-12)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [items, activities, streams])

  const send = () => {
    if (!text.trim()) return
    sendChat(text, threadId)
    setText('')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (!thread) return null

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-6 h-12 border-b border-zinc-800 shrink-0">
        <button onClick={closeThread} className="text-sm text-zinc-400 hover:text-white">
          ← Threads
        </button>
        <div className="min-w-0">
          <span className="text-sm text-zinc-200 truncate">{thread.title}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-zinc-500">{thread.agentLabel}</span>
          {activePromptId && (
            <button onClick={() => cancelPrompt(activePromptId)} className="text-xs text-zinc-400 hover:text-white">
              Stop
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-5">
          {items.map(item => (
            <ChatMessage key={item.key} item={item} onStop={cancelPrompt} />
          ))}
          {acts.length > 0 && (
            <div className="space-y-1.5 border-t border-zinc-800 pt-3">
              {acts.map(activity => (
                <div key={activity.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      activity.status === 'running' ? 'bg-white animate-pulse' : 'bg-zinc-600'
                    }`}
                  />
                  <span className="text-zinc-300">
                    {activity.kind === 'subagent' ? `${activity.name} (agent)` : activity.name}
                  </span>
                  {activity.detail && <span className="text-zinc-600 truncate">{activity.detail}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={`Reply in this thread with ${thread.agentLabel}.`}
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
  )
}
