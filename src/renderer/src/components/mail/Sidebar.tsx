import { useMemo, useState, type ReactNode } from 'react'
import type { MailAccount, MailboxId } from '../../state/mail'
import {
  AtGlyph,
  ChevronLeftGlyph,
  ClockGlyph,
  DocGlyph,
  InboxGlyph,
  MailGlyph,
  MoreGlyph,
  PlusGlyph,
  SendGlyph,
  SpamGlyph,
  StarGlyph,
  TrashGlyph,
} from '../../icons'
import { AddAccount, AccountSettings } from './Accounts'
import { AccountMark, IconButton } from './parts'
import Select from '../Select'

export interface MailLocation {
  accountId?: string
  mailboxId?: MailboxId
  labelId?: string
}

const MAILBOXES: Array<{ id: MailboxId; label: string; icon: ReactNode }> = [
  { id: 'inbox', label: 'Inbox', icon: <InboxGlyph className="w-4 h-4" /> },
  { id: 'starred', label: 'Starred', icon: <StarGlyph className="w-4 h-4" /> },
  { id: 'snoozed', label: 'Snoozed', icon: <ClockGlyph className="w-4 h-4" /> },
  { id: 'sent', label: 'Sent', icon: <SendGlyph className="w-4 h-4" /> },
  { id: 'drafts', label: 'Drafts', icon: <DocGlyph className="w-4 h-4" /> },
  { id: 'scheduled', label: 'Scheduled', icon: <ClockGlyph className="w-4 h-4" /> },
  { id: 'all', label: 'All mail', icon: <MailGlyph className="w-4 h-4" /> },
  { id: 'spam', label: 'Spam', icon: <SpamGlyph className="w-4 h-4" /> },
  { id: 'trash', label: 'Trash', icon: <TrashGlyph className="w-4 h-4" /> }
]

function NavRow({
  label,
  icon,
  count,
  selected,
  onClick
}: {
  label: string
  icon: ReactNode
  count?: number
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-selected={selected ? '' : undefined}
      className="w-full h-9 px-3 rounded-xl flex items-center gap-3 text-sm text-fg/60 transition-colors hover:bg-fg/[0.05] hover:text-fg data-selected:bg-fg/[0.09] data-selected:text-fg active:scale-[0.98]"
    >
      <span className="w-4 h-4 shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 truncate text-left">{label}</span>
      {Boolean(count) && <span className="text-xs tabular-nums text-fg/40">{count}</span>}
    </button>
  )
}

export default function MailSidebar({
  accounts,
  location,
  onLocation,
  onCompose,
  onBack
}: {
  accounts: MailAccount[]
  location: MailLocation
  onLocation: (location: MailLocation) => void
  onCompose: () => void
  onBack?: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [settings, setSettings] = useState<MailAccount | null>(null)
  const chosen = location.accountId ? accounts.find(account => account.id === location.accountId) : undefined
  const unread = useMemo(() => accounts.reduce((sum, account) => sum + account.unread, 0), [accounts])
  const labels = chosen?.labels ?? []
  const accountOptions = [
    {
      value: '',
      label: 'All accounts',
      hint: unread || undefined,
      mark: <AtGlyph className="w-4 h-4" />
    },
    ...accounts.map(account => ({
      value: account.id,
      label: account.email,
      hint: account.unread || undefined,
      mark: <AccountMark email={account.email} />
    }))
  ]

  return (
    <aside className="h-full min-h-0 flex flex-col bg-ink-900 border-r border-fg/[0.06]">
      <div aria-hidden className="app-drag h-[70px] shrink-0" />

      <div className="shrink-0 px-3 pb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onCompose}
          className="min-w-0 flex-1 h-10 rounded-full bg-fg text-ink-900 flex items-center justify-center gap-2 text-sm font-semibold transition-colors hover:bg-fg/90 active:scale-[0.98]"
        >
          <PlusGlyph className="w-4 h-4" />
          Compose
        </button>
        {onBack && (
          <IconButton label="Back to mail" onClick={onBack}>
            <ChevronLeftGlyph className="w-4 h-4" />
          </IconButton>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pt-1 pb-4">
        <section className="space-y-0.5">
          {MAILBOXES.map(mailbox => (
            <NavRow
              key={mailbox.id}
              label={mailbox.label}
              icon={mailbox.icon}
              selected={!location.labelId && location.mailboxId === mailbox.id}
              onClick={() => onLocation({ accountId: location.accountId, mailboxId: mailbox.id })}
            />
          ))}
        </section>

        {labels.length > 0 && (
          <section className="mt-5 space-y-0.5">
            <h2 className="px-3 mb-1.5 text-xs font-semibold text-fg/35">Labels</h2>
            {labels.map(label => (
              <NavRow
                key={label.id}
                label={label.name}
                count={label.unread}
                icon={
                  <span
                    className="block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: label.color ?? 'rgb(var(--color-fg) / 0.35)' }}
                  />
                }
                selected={location.labelId === label.id}
                onClick={() => onLocation({ accountId: location.accountId, labelId: label.id })}
              />
            ))}
          </section>
        )}
      </div>

      {accounts.some(account => account.status !== 'connected') && (
        <div className="shrink-0 border-t border-fg/[0.06] p-2.5 space-y-0.5">
          {accounts
            .filter(account => account.status !== 'connected')
            .map(account => (
              <button
                key={account.id}
                type="button"
                onClick={() => setSettings(account)}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-left text-xs text-fg/60 transition-colors hover:bg-fg/[0.05] hover:text-fg active:scale-[0.98]"
              >
                <span className={`w-2 h-2 rounded-full ${account.status === 'error' ? 'bg-danger' : 'bg-fg/30'}`} />
                <span className="min-w-0 flex-1 truncate">{account.email}</span>
                <span>{account.status === 'syncing' ? 'Syncing' : account.status === 'offline' ? 'Offline' : 'Reconnect'}</span>
              </button>
            ))}
        </div>
      )}

      <div className="shrink-0 border-t border-fg/[0.06] p-2.5 flex items-center gap-1">
        <Select
          name="Mail account"
          value={location.accountId ?? ''}
          options={accountOptions}
          onChange={accountId =>
            onLocation(accountId ? { accountId, mailboxId: 'inbox' } : { mailboxId: 'inbox' })
          }
          add={{ label: 'Add account', onPick: () => setAdding(true) }}
          full
        />
        {chosen && (
          <IconButton label="Account settings" onClick={() => setSettings(chosen)}>
            <MoreGlyph className="w-4 h-4" />
          </IconButton>
        )}
      </div>

      <AddAccount open={adding} onClose={() => setAdding(false)} />
      <AccountSettings account={settings} open={Boolean(settings)} onClose={() => setSettings(null)} />
    </aside>
  )
}
