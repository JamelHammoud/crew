import { useCrew, type ThreadMeta } from '../state/store'
import Markdown from './Markdown'
import ThreadCardShell from './ThreadCardShell'

export default function PlanCard({ thread, ts, onOpen }: { thread: ThreadMeta; ts: number; onOpen: () => void }) {
  const implementPlan = useCrew(s => s.implementPlan)

  return (
    <ThreadCardShell thread={thread} ts={ts} onOpen={onOpen}>
      <div className="relative max-h-72 overflow-hidden px-5 pb-2">
        <Markdown text={thread.plan ?? ''} />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-900 to-transparent pointer-events-none" />
      </div>
      <div className="bg-ink-700 px-5 h-[52px] flex items-center gap-3">
        <button
          onClick={() => implementPlan(thread.id)}
          className="h-9 px-4 rounded-full bg-fg text-ink-900 text-sm font-semibold shrink-0 transition-transform duration-150 hover:scale-105 active:scale-95"
        >
          Implement plan
        </button>
        <button
          onClick={onOpen}
          className="h-9 px-4 rounded-full bg-ink-800 text-sm font-semibold text-fg-secondary shrink-0 transition-all duration-150 hover:text-fg active:scale-95"
        >
          Open
        </button>
      </div>
    </ThreadCardShell>
  )
}
