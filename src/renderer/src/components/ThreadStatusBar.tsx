import { ChevronRightIcon } from '@heroicons/react/16/solid'
import type { ReactNode } from 'react'
import { useCrew, type ThreadMeta } from '../state/store'

export default function ThreadStatusBar({
  thread,
  icon,
  label,
  detail,
  danger
}: {
  thread: ThreadMeta
  icon: ReactNode
  label: string
  detail?: string
  danger?: boolean
}) {
  const owner = useCrew(s => s.agents.find(a => a.id === thread.agentId))?.ownerName

  return (
    <div className="relative w-full bg-ink-700 px-5 h-[52px] flex items-center gap-3 text-left">
      {icon}
      <span className={`text-base font-semibold shrink-0 ${danger ? 'text-danger' : 'text-fg'}`}>{label}</span>
      <span className="text-base text-fg-muted truncate flex-1">{detail}</span>
      {owner && (
        <span className="relative self-stretch shrink-0 flex items-center bg-ink-700 transition-transform duration-200 group-hover:-translate-x-5">
          <span className="absolute right-full inset-y-0 w-10 bg-gradient-to-l from-ink-700 to-transparent pointer-events-none" />
          <span className="text-base font-semibold text-fg-muted">{owner}'s PC</span>
        </span>
      )}
      <ChevronRightIcon className="w-4 h-4 text-fg-muted absolute right-4 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
    </div>
  )
}
