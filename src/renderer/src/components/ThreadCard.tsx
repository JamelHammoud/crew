import { CheckIcon, ChevronRightIcon } from '@heroicons/react/16/solid'
import { useCrew, type ThreadMeta } from '../state/store'
import Avatar from './Avatar'
import Spinner from './Spinner'
import { formatTime } from './time'

export default function ThreadCard({
  thread,
  ts,
  working,
  status,
  onOpen
}: {
  thread: ThreadMeta
  ts: number
  working: boolean
  status: string
  onOpen: () => void
}) {
  const owner = useCrew(s => s.agents.find(a => a.id === thread.agentId)?.ownerName)

  return (
    <div className="flex gap-4 animate-rise">
      <Avatar name={thread.createdBy} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-base font-semibold text-fg-muted">{thread.createdBy}</span>
          <span className="text-sm text-fg-faint">{formatTime(ts)}</span>
        </div>
        <button
          onClick={onOpen}
          className="group w-full text-left mt-2 border-2 border-ink-700 rounded-card overflow-hidden transition-all duration-200 hover:border-ink-600 hover:-translate-y-px active:translate-y-0"
        >
          <p className="px-5 py-4 text-base text-fg leading-[26px] line-clamp-2">
            <strong className="font-semibold">@{thread.agentLabel}</strong>{' '}
            {thread.title.replace(new RegExp(`^@${thread.agentLabel}\\s*`), '')}
          </p>
          <div className="relative bg-ink-700 px-5 h-[52px] flex items-center gap-3">
            {working ? (
              <Spinner size={16} className="text-fg" />
            ) : (
              <CheckIcon className="w-4 h-4 text-fg shrink-0" />
            )}
            <span className="text-base font-semibold text-fg shrink-0">{working ? 'Working' : 'Done'}</span>
            <span className="text-base text-fg-muted truncate flex-1">{status}</span>
            {owner && (
              <span className="text-base font-semibold text-fg-muted shrink-0 transition-transform duration-200 group-hover:-translate-x-5">
                {owner}
              </span>
            )}
            <ChevronRightIcon className="w-4 h-4 text-fg-muted absolute right-4 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
          </div>
        </button>
      </div>
    </div>
  )
}
