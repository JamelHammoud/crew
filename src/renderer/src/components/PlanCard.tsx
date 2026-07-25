import { ClipboardDocumentListIcon } from '@heroicons/react/16/solid'
import { useCrew, type ThreadMeta } from '../state/store'
import Avatar from './Avatar'
import Markdown from './Markdown'
import { MemberName } from './Mention'
import Pill from './Pill'
import { usePresence } from './presence'
import { formatFullTime, formatTime } from './time'
import Tooltip from './Tooltip'

export default function PlanCard({ thread, ts, onOpen }: { thread: ThreadMeta; ts: number; onOpen: () => void }) {
  const implementPlan = useCrew(s => s.implementPlan)
  const presence = usePresence(thread.createdBy)

  return (
    <div className="flex gap-4 animate-rise">
      <Avatar name={thread.createdBy} presence={presence} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-baseline gap-2.5">
          <MemberName name={thread.createdBy}>
            <span className="text-base font-semibold text-fg-muted transition-colors hover:text-fg-secondary cursor-default">
              {thread.createdBy}
            </span>
          </MemberName>
          <Tooltip label={formatFullTime(ts)}>
            <span className="text-sm text-fg-faint cursor-default">{formatTime(ts)}</span>
          </Tooltip>
        </div>
        <div className="mt-2 border border-ink-700 rounded-card overflow-hidden transition-colors duration-200 hover:border-ink-600">
          <button onClick={onOpen} className="w-full text-left px-5 py-4 flex items-center gap-2.5">
            <ClipboardDocumentListIcon className="w-4 h-4 text-fg-muted shrink-0" />
            <span className="text-base text-fg truncate flex-1">{thread.title}</span>
            <Pill>{thread.agentLabel}</Pill>
          </button>
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
        </div>
      </div>
    </div>
  )
}
