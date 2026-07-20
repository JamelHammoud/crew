import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import RunStatus from '../components/RunStatus'
import ThreadItems from '../components/ThreadItems'
import { buildThread } from '../components/thread'
import { useAutoResize } from '../components/useAutoResize'
import { useCrew } from '../state/store'

export default function ThreadView({ threadId }: { threadId: string }) {
  const events = useCrew(s => s.events)
  const steps = useCrew(s => s.steps)
  const selfId = useCrew(s => s.selfId)
  const thread = useCrew(s => s.threads[threadId])
  const activePromptId = useCrew(s => s.threadPrompts[threadId])
  const tokens = useCrew(s => (activePromptId ? (s.tokens[activePromptId] ?? 0) : 0))
  const sendChat = useCrew(s => s.sendChat)
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const closeThread = useCrew(s => s.closeThread)

  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useAutoResize(text)

  const threadEvents = useMemo(() => events.filter(e => 'threadId' in e && e.threadId === threadId), [events, threadId])
  const items = useMemo(() => buildThread(threadEvents, steps, selfId), [threadEvents, steps, selfId])
  const startedAt = threadEvents.find(e => e.kind === 'agent.start' && e.promptId === activePromptId)?.ts

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [items])

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
        <div className="max-w-3xl mx-auto space-y-4">
          <ThreadItems items={items} />
          {activePromptId && startedAt && (
            <RunStatus
              startedAt={startedAt}
              tokens={tokens}
              steps={steps[activePromptId] ?? []}
              onStop={() => cancelPrompt(activePromptId)}
            />
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
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
