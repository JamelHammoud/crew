import { CheckIcon, ChevronLeftIcon } from '@heroicons/react/20/solid'
import { useLayoutEffect, useMemo, useRef } from 'react'
import Avatar from '../components/Avatar'
import Composer from '../components/Composer'
import { usePresence } from '../components/presence'
import RunStatus from '../components/RunStatus'
import Spinner from '../components/Spinner'
import ThreadItems from '../components/ThreadItems'
import Tooltip from '../components/Tooltip'
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
  const text = useCrew(s => s.threadDrafts[threadId] ?? '')
  const setThreadDraft = useCrew(s => s.setThreadDraft)
  const pendingCount = useCrew(s => (s.pending[threadId] ?? []).length)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useAutoResize(text)
  const agentPresence = usePresence(thread?.agentLabel ?? '')

  const threadEvents = useMemo(() => events.filter(e => 'threadId' in e && e.threadId === threadId), [events, threadId])
  const items = useMemo(() => buildThread(threadEvents, steps, selfId), [threadEvents, steps, selfId])
  const startedAt = threadEvents.find(e => e.kind === 'agent.start' && e.promptId === activePromptId)?.ts

  const didInitialScroll = useRef(false)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!didInitialScroll.current) {
      didInitialScroll.current = true
      el.scrollTop = el.scrollHeight
      return
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [items])

  const send = () => {
    if (!text.trim() && pendingCount === 0) return
    sendChat(text, threadId)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (!thread) return null

  return (
    <div className="h-full relative">
      <div ref={scrollRef} className="h-full overflow-y-auto px-6">
        <div className="max-w-[660px] mx-auto pt-28 pb-64 space-y-5">
          <ThreadItems items={items} />
          {activePromptId && startedAt && (
            <RunStatus startedAt={startedAt} tokens={tokens} steps={steps[activePromptId] ?? []} />
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 pointer-events-none">
        <div className="h-14 bg-gradient-to-t from-ink-900 to-transparent" />
        <div className="bg-ink-900 px-6 pb-6">
          <div className="max-w-[660px] mx-auto pointer-events-auto animate-rise">
            <div className="bg-ink-900 border-2 border-b-0 border-ink-700 rounded-t-[30px] flex items-center gap-3 px-3 pt-2.5 pb-12 -mb-9">
              <Tooltip label="Back to chat">
                <button
                  onClick={closeThread}
                  aria-label="Back to chat"
                  className="w-10 h-10 rounded-full bg-ink-800 text-fg-secondary flex items-center justify-center transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95 shrink-0"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
              </Tooltip>
              <Avatar name={thread.agentLabel} presence={agentPresence} />
              <span className="text-base font-bold text-fg truncate">{thread.agentLabel}</span>
              <div className="ml-auto flex items-center gap-2 pr-2 shrink-0">
                {activePromptId ? (
                  <>
                    <Spinner size={16} className="text-fg" />
                    <span className="text-base font-semibold text-fg">Working</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5 text-fg" />
                    <span className="text-base font-semibold text-fg">Done</span>
                  </>
                )}
              </div>
            </div>
            <div className="relative">
              <Composer
              attachmentKey={threadId}
              value={text}
              placeholder="Send a message"
              inputRef={inputRef}
              onChange={value => setThreadDraft(threadId, value)}
              onKeyDown={onKeyDown}
              onSend={send}
                onStop={activePromptId ? () => cancelPrompt(activePromptId) : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
