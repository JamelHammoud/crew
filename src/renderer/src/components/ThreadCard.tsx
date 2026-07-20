import { ArchiveBoxIcon, CheckIcon, ChevronRightIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { useCrew, type ThreadMeta } from '../state/store'
import Avatar from './Avatar'
import { AgentMention, MemberName } from './Mention'
import { MenuItem, Popover } from './Popover'
import { usePresence } from './presence'
import Spinner from './Spinner'
import Tooltip from './Tooltip'
import { formatFullTime, formatTime } from './time'

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
  const agent = useCrew(s => s.agents.find(a => a.id === thread.agentId))
  const archiveThread = useCrew(s => s.archiveThread)
  const owner = agent?.ownerName
  const presence = usePresence(thread.createdBy)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  return (
    <div
      className="flex gap-4 animate-rise"
      onContextMenu={event => {
        event.preventDefault()
        setMenuAt({ x: event.clientX, y: event.clientY })
      }}
    >
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
        <button
          onClick={onOpen}
          className="group w-full text-left mt-2 border border-ink-700 rounded-card overflow-hidden transition-colors duration-200 hover:border-ink-600"
        >
          <p className="px-5 py-4 text-base text-fg leading-[22px] truncate">
            {agent ? (
              <AgentMention agent={agent}>@{thread.agentLabel}</AgentMention>
            ) : (
              <strong className="font-semibold">@{thread.agentLabel}</strong>
            )}{' '}
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
              <span className="relative self-stretch shrink-0 flex items-center bg-ink-700 transition-transform duration-200 group-hover:-translate-x-5">
                <span className="absolute right-full inset-y-0 w-10 bg-gradient-to-l from-ink-700 to-transparent pointer-events-none" />
                <span className="text-base font-semibold text-fg-muted">{owner}'s PC</span>
              </span>
            )}
            <ChevronRightIcon className="w-4 h-4 text-fg-muted absolute right-4 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
          </div>
        </button>
      </div>
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined}>
        <MenuItem
          icon={<ArchiveBoxIcon />}
          label="Archive thread"
          onClick={() => {
            setMenuAt(null)
            archiveThread(thread.id)
          }}
        />
      </Popover>
    </div>
  )
}
