import type { ThreadMeta } from '../state/store'
import Pill from './Pill'

export default function ThreadCard({
  thread,
  working,
  status,
  onOpen
}: {
  thread: ThreadMeta
  working: boolean
  status: string
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 space-y-1.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white truncate">{thread.title}</span>
        <div className="ml-auto shrink-0">
          <Pill solid={working}>{working ? 'Working' : 'Done'}</Pill>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="text-zinc-400">{thread.agentLabel}</span>
        <span>·</span>
        <span className="truncate flex items-center gap-1.5">
          {working && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />}
          {status}
        </span>
      </div>
    </button>
  )
}
