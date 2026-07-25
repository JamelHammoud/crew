import { ClipboardDocumentListIcon } from '@heroicons/react/16/solid'
import { useCrew, type ThreadMeta } from '../state/store'
import Markdown from './Markdown'
import Pill from './Pill'

export default function PlanPanel({ thread }: { thread: ThreadMeta }) {
  const implementPlan = useCrew(s => s.implementPlan)
  const running = useCrew(s => Boolean(s.threadPrompts[thread.id]))
  if (!thread.plan) return null

  return (
    <aside className="w-[340px] shrink-0 border-l border-ink-700 flex flex-col pt-[70px]">
      <div className="px-5 pb-4 flex items-center gap-2.5">
        <ClipboardDocumentListIcon className="w-4 h-4 text-fg-muted shrink-0" />
        <span className="text-base font-semibold text-fg">Plan</span>
        <Pill>{thread.mode === 'plan' ? 'Not started' : 'Building'}</Pill>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <Markdown text={thread.plan} />
      </div>
      {thread.mode === 'plan' && (
        <div className="p-4 border-t border-ink-700">
          <button
            onClick={() => implementPlan(threadId)}
            disabled={running}
            className="w-full h-11 rounded-full bg-fg text-ink-900 text-base font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-95 disabled:bg-fg/10 disabled:text-fg-muted disabled:scale-100"
          >
            Implement plan
          </button>
        </div>
      )}
    </aside>
  )
}
