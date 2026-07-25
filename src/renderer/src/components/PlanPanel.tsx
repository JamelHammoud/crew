import { ClipboardDocumentListIcon } from '@heroicons/react/16/solid'
import { useRef } from 'react'
import { useCrew } from '../state/store'
import Markdown from './Markdown'
import Pill from './Pill'
import ScrollFade from './ScrollFade'
import useScrollEdges from './useScrollEdges'

export default function PlanPanel({ threadId }: { threadId: string }) {
  const thread = useCrew(s => s.threads[threadId])
  const implementPlan = useCrew(s => s.implementPlan)
  const running = useCrew(s => Boolean(s.threadPrompts[threadId]))
  const scrollRef = useRef<HTMLDivElement>(null)
  const { edges } = useScrollEdges(scrollRef)
  if (!thread?.plan) return null

  return (
    <aside className="w-[340px] shrink-0 border-l border-ink-700 flex flex-col bg-ink-900">
      <div className="app-drag h-[70px] shrink-0 px-5 flex items-center gap-2.5">
        <ClipboardDocumentListIcon className="w-4 h-4 text-fg-muted shrink-0" />
        <span className="text-base font-semibold text-fg">Plan</span>
        <Pill>{thread.mode === 'plan' ? 'Not started' : 'Building'}</Pill>
      </div>
      <div className="relative flex-1 min-h-0 min-w-0">
        <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden px-5 pb-4">
          <Markdown text={thread.plan} />
        </div>
        <ScrollFade edges={edges} />
      </div>
      {thread.mode === 'plan' && (
        <div className="p-4">
          <button
            onClick={() => implementPlan(threadId)}
            disabled={running}
            className="w-full h-11 rounded-full bg-fg text-ink-900 text-base font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:bg-fg/10 disabled:text-fg-muted disabled:opacity-100"
          >
            Implement plan
          </button>
        </div>
      )}
    </aside>
  )
}
