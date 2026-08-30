import { useEffect, useMemo, useState } from 'react'
import type { MailAccount, MailThreadSummary, MailboxId } from '../../state/mail'
import { useMail } from '../../state/mail'
import {
  ArchiveGlyph,
  AttachmentGlyph,
  CheckGlyph,
  ChevronLeftGlyph,
  MailGlyph,
  RefreshGlyph,
  SpamGlyph,
  StarGlyph,
  TrashGlyph,
  UnreadGlyph
} from '../../icons'
import Empty from '../Empty'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import SearchField from '../SearchField'
import Skeleton from '../Skeleton'
import { toast } from '../../state/toast'
import type { MailLocation } from './Sidebar'
import { AccountMark, displayAddress, IconButton, mailDate } from './parts'

const MAILBOX_NAMES: Record<MailboxId, string> = {
  inbox: 'Inbox',
  starred: 'Starred',
  snoozed: 'Snoozed',
  sent: 'Sent',
  drafts: 'Drafts',
  scheduled: 'Scheduled',
  all: 'All mail',
  spam: 'Spam',
  trash: 'Trash'
}

function SelectionButton({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={event => {
        event.stopPropagation()
        onClick()
      }}
      className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center border transition-[border-color,color,transform] active:scale-90 ${
        selected ? 'border-fg bg-fg text-ink-900' : 'border-fg/20 text-transparent hover:border-fg/55'
      }`}
    >
      <CheckGlyph className="w-3.5 h-3.5" />
    </button>
  )
}

function ThreadRow({
  thread,
  account,
  unified,
  selected,
  open,
  onSelect,
  onOpen,
  onChange
}: {
  thread: MailThreadSummary
  account?: MailAccount
  unified: boolean
  selected: boolean
  open: boolean
  onSelect: () => void
  onOpen: () => void
  onChange: (patch: { read?: boolean; starred?: boolean; mailboxId?: MailboxId }) => void
}) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const people = thread.participants.map(person => displayAddress(person.name, person.email)).join(', ')
  const change = (patch: { read?: boolean; starred?: boolean; mailboxId?: MailboxId }) => {
    setMenuAt(null)
    onChange(patch)
  }

  return (
    <div
      aria-selected={open}
      data-open={open ? '' : undefined}
      data-unread={thread.unread ? '' : undefined}
      onContextMenu={event => {
        event.preventDefault()
        setMenuAt({ x: event.clientX, y: event.clientY })
      }}
      className="group min-w-0 px-3 py-3 rounded-xl flex gap-3 text-left transition-colors hover:bg-fg/[0.045] focus-within:bg-fg/[0.045] data-open:bg-fg/[0.08] data-unread:bg-fg/[0.025] data-unread:hover:bg-fg/[0.06]"
    >
      <div className="pt-0.5">
        <SelectionButton selected={selected} onClick={onSelect} label={selected ? 'Clear selection' : 'Select'} />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onOpen()
        }}
        className="min-w-0 flex-1 text-left outline-none cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {unified && account && <AccountMark email={account.email} />}
          <span className={`min-w-0 flex-1 truncate text-sm ${thread.unread ? 'font-semibold text-fg' : 'text-fg/70'}`}>
            {people || 'Unknown sender'}
          </span>
          {thread.messageCount > 1 && <span className="text-xs text-fg/30">{thread.messageCount}</span>}
          <time className={`text-xs tabular-nums ${thread.unread ? 'font-semibold text-fg/70' : 'text-fg/35'}`}>
            {mailDate(thread.date)}
          </time>
        </div>
        <div className={`mt-1 truncate text-sm ${thread.unread ? 'font-medium text-fg/90' : 'text-fg/60'}`}>
          {thread.subject || '(no subject)'}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg/35">
          {thread.hasAttachments && <AttachmentGlyph className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate">{thread.preview}</span>
        </div>
      </div>
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined} className="min-w-48">
        <MenuItem
          icon={thread.unread ? <MailGlyph /> : <UnreadGlyph />}
          label={thread.unread ? 'Mark read' : 'Mark unread'}
          onClick={() => change({ read: thread.unread })}
        />
        <MenuItem
          icon={<StarGlyph />}
          label={thread.starred ? 'Unstar' : 'Star'}
          onClick={() => change({ starred: !thread.starred })}
        />
        <MenuDivider />
        <MenuItem icon={<ArchiveGlyph />} label="Archive" onClick={() => change({ mailboxId: 'all' })} />
        <MenuItem icon={<SpamGlyph />} label="Move to spam" onClick={() => change({ mailboxId: 'spam' })} />
        <MenuItem
          icon={<TrashGlyph />}
          label="Move to trash"
          danger
          onClick={() => change({ mailboxId: 'trash' })}
        />
      </Popover>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="px-3 py-3 space-y-5">
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="w-5 h-5 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5 rounded-full" />
            <Skeleton className="h-3 w-4/5 rounded-full" />
            <Skeleton className="h-2.5 w-3/5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ThreadList({
  accounts,
  threads,
  location,
  query,
  loading,
  syncing,
  activeId,
  narrow,
  onQuery,
  onOpen,
  onBack,
  onRefresh
}: {
  accounts: MailAccount[]
  threads: MailThreadSummary[]
  location: MailLocation
  query: string
  loading: boolean
  syncing: boolean
  activeId?: string
  narrow: boolean
  onQuery: (query: string) => void
  onOpen: (thread: MailThreadSummary) => void
  onBack: () => void
  onRefresh: () => void
}) {
  const setThreads = useMail(state => state.setThreads)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const chosen = location.accountId ? accounts.find(account => account.id === location.accountId) : undefined
  const label = location.labelId ? chosen?.labels.find(one => one.id === location.labelId)?.name : undefined
  const title = label ?? (location.mailboxId ? MAILBOX_NAMES[location.mailboxId] : 'Mail')

  useEffect(() => setSelected(new Set()), [location.accountId, location.labelId, location.mailboxId, query])

  const selectedThreads = useMemo(
    () => threads.filter(thread => selected.has(`${thread.accountId}:${thread.id}`)),
    [selected, threads]
  )

  const apply = async (patch: { read?: boolean; starred?: boolean; mailboxId?: MailboxId }) => {
    const groups = new Map<string, string[]>()
    for (const thread of selectedThreads) groups.set(thread.accountId, [...(groups.get(thread.accountId) ?? []), thread.id])
    const results = await Promise.all([...groups].map(([accountId, ids]) => setThreads(accountId, ids, patch)))
    const error = results.find(Boolean)
    if (error) toast.fail(error)
    else setSelected(new Set())
  }

  const toggle = (id: string) => {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="h-full min-h-0 flex flex-col bg-ink-900 border-r border-fg/[0.06]">
      <div className="h-16 shrink-0 px-3 flex items-end pb-2">
        <div className="min-w-0 flex-1 flex items-center gap-1">
          {narrow && (
            <IconButton label="Mailboxes" onClick={onBack}>
              <ChevronLeftGlyph className="w-4 h-4" />
            </IconButton>
          )}
          <h1 className="min-w-0 flex-1 truncate px-1 text-lg font-semibold text-fg">{title}</h1>
          <IconButton label="Refresh" onClick={onRefresh} disabled={syncing}>
            <RefreshGlyph className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </IconButton>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="h-12 shrink-0 px-3 border-y border-fg/[0.06] flex items-center gap-1">
          <SelectionButton
            selected={selected.size === threads.length}
            onClick={() =>
              setSelected(
                selected.size === threads.length
                  ? new Set()
                  : new Set(threads.map(one => `${one.accountId}:${one.id}`))
              )
            }
            label={selected.size === threads.length ? 'Clear selection' : 'Select all'}
          />
          <span className="ml-2 mr-auto text-xs font-medium text-fg/50 tabular-nums">{selected.size} selected</span>
          <IconButton label="Mark unread" onClick={() => void apply({ read: false })}>
            <UnreadGlyph className="w-4 h-4" />
          </IconButton>
          <IconButton label="Star" onClick={() => void apply({ starred: true })}>
            <StarGlyph className="w-4 h-4" />
          </IconButton>
          <IconButton label="Archive" onClick={() => void apply({ mailboxId: 'all' })}>
            <ArchiveGlyph className="w-4 h-4" />
          </IconButton>
          <IconButton label="Move to spam" onClick={() => void apply({ mailboxId: 'spam' })}>
            <SpamGlyph className="w-4 h-4" />
          </IconButton>
          <IconButton label="Move to trash" onClick={() => void apply({ mailboxId: 'trash' })}>
            <TrashGlyph className="w-4 h-4" />
          </IconButton>
        </div>
      ) : (
        <SearchField value={query} onChange={onQuery} placeholder="Search mail" autoFocus={false} />
      )}

      <div className="min-h-0 flex-1 relative overflow-y-auto px-1.5 py-1.5">
        {loading ? (
          <ListSkeleton />
        ) : threads.length === 0 ? (
          <Empty
            icon={<MailGlyph className="w-8 h-8 text-fg-faint" />}
            label={query ? 'No mail found' : location.mailboxId === 'inbox' ? 'Inbox is clear' : 'Nothing here'}
          />
        ) : (
          <div className="space-y-0.5">
            {threads.map(thread => (
              <ThreadRow
                key={`${thread.accountId}:${thread.id}`}
                thread={thread}
                account={accounts.find(account => account.id === thread.accountId)}
                unified={!location.accountId}
                selected={selected.has(`${thread.accountId}:${thread.id}`)}
                open={activeId === `${thread.accountId}:${thread.id}`}
                onSelect={() => toggle(`${thread.accountId}:${thread.id}`)}
                onOpen={() => onOpen(thread)}
                onChange={patch => {
                  void setThreads(thread.accountId, [thread.id], patch).then(error => error && toast.fail(error))
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
