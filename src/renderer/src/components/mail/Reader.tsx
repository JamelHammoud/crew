import { useEffect, useState } from 'react'
import type { MailAddress, MailMessage, MailThread, MailThreadStatePatch } from '../../state/mail'
import { useMail } from '../../state/mail'
import {
  ArchiveGlyph,
  ClockGlyph,
  ChevronDownGlyph,
  ChevronLeftGlyph,
  ChevronUpGlyph,
  FileGlyph,
  ForwardGlyph,
  LabelGlyph,
  MailGlyph,
  MoreGlyph,
  ReplyAllGlyph,
  ReplyGlyph,
  StarGlyph,
  SpamGlyph,
  TrashGlyph,
  UnreadGlyph
} from '../../icons'
import Empty from '../Empty'
import { MenuDivider, MenuItem, Popover, SubMenu } from '../Popover'
import Skeleton from '../Skeleton'
import { toast } from '../../state/toast'
import MailAttachments from './Attachments'
import HtmlMessage from './HtmlMessage'
import { ContactMark, displayAddress, fullAddress, IconButton, MailAddressButton, mailDate } from './parts'

function unique(addresses: MailAddress[]): MailAddress[] {
  const seen = new Set<string>()
  return addresses.filter(address => {
    const key = address.email.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function replySubject(subject: string, prefix: 'Re' | 'Fwd'): string {
  return new RegExp(`^${prefix}:`, 'i').test(subject) ? subject : `${prefix}: ${subject}`
}

function forwardText(message: MailMessage): string {
  const to = message.to.map(address => fullAddress(address.name, address.email)).join(', ')
  return `\n\nFrom: ${fullAddress(message.from.name, message.from.email)}\nDate: ${mailDate(message.date, true)}\nSubject: ${message.subject}\nTo: ${to}\n\n${message.text}`
}

function AddressList({ addresses }: { addresses: MailAddress[] }) {
  return (
    <span className="min-w-0 flex items-baseline overflow-hidden">
      {addresses.map((address, index) => (
        <span key={`${address.email.toLowerCase()}-${index}`} className="min-w-0 flex items-baseline">
          {index > 0 && <span className="mr-1">,</span>}
          <MailAddressButton name={address.name} email={address.email} />
        </span>
      ))}
    </span>
  )
}

function AddressLine({ label, addresses }: { label: string; addresses: MailAddress[] }) {
  if (addresses.length === 0) return null
  return (
    <span className="flex min-w-0 items-baseline gap-1 text-xs leading-4 text-fg/40">
      <span className="shrink-0">{label}</span>
      <AddressList addresses={addresses} />
    </span>
  )
}

function Message({
  message,
  accountId,
  accountEmail,
  expanded,
  onToggle,
  onDraft
}: {
  message: MailMessage
  accountId: string
  accountEmail: string
  expanded: boolean
  onToggle: () => void
  onDraft: (mode: 'reply' | 'reply-all' | 'forward') => void
}) {
  const saveAttachment = useMail(state => state.saveAttachment)
  const [quote, setQuote] = useState(false)
  const others = unique([message.from, ...message.to, ...message.cc]).filter(
    address => address.email.toLowerCase() !== accountEmail.toLowerCase()
  )

  const save = async (attachmentId: string) => {
    const error = await saveAttachment(message.id, attachmentId)
    if (error) toast.fail(error)
  }

  return (
    <article className="rounded-card border border-fg/[0.075]">
      <div
        className={`w-full px-4 py-3.5 flex items-start gap-3 rounded-t-[19px] text-left transition-colors hover:bg-fg/[0.025] ${
          expanded ? '' : 'rounded-b-[19px]'
        }`}
      >
        <button
          type="button"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} message from ${displayAddress(message.from.name, message.from.email)}`}
          onClick={onToggle}
          className="shrink-0 rounded-full transition-opacity hover:opacity-80 active:scale-95"
        >
          <ContactMark name={message.from.name} email={message.from.email} size="md" />
        </button>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <MailAddressButton
              name={message.from.name}
              email={message.from.email}
              className="text-sm font-semibold text-fg"
            />
            <time className="ml-auto text-xs text-fg/35 tabular-nums shrink-0">{mailDate(message.date, true)}</time>
          </span>
          <span className="mt-0.5 block space-y-0.5">
            <AddressLine label="to" addresses={message.to} />
            <AddressLine label="cc" addresses={message.cc} />
            <AddressLine label="bcc" addresses={message.bcc} />
          </span>
        </span>
        <button
          type="button"
          aria-label={expanded ? 'Collapse message' : 'Expand message'}
          onClick={onToggle}
          className="mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg/30 transition-colors hover:bg-fg/[0.07] hover:text-fg active:scale-90"
        >
          {expanded ? <ChevronUpGlyph className="w-4 h-4" /> : <ChevronDownGlyph className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-5 sm:px-5 sm:pb-6">
          <div className="select-text">
            <HtmlMessage html={message.html} text={message.text} accountId={accountId} />
          </div>

          {message.quotedText && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setQuote(value => !value)}
                className="h-7 px-2.5 rounded-full bg-fg/[0.05] text-xs font-medium text-fg/40 transition-colors hover:bg-fg/[0.09] hover:text-fg/70 active:scale-95"
              >
                {quote ? 'Hide earlier mail' : 'Show earlier mail'}
              </button>
              {quote && (
                <div className="mt-3 pl-4 border-l-2 border-fg/[0.08] text-sm leading-6 text-fg/45 whitespace-pre-wrap select-text">
                  {message.quotedText}
                </div>
              )}
            </div>
          )}

          <MailAttachments attachments={message.attachments} onSave={attachment => void save(attachment.id)} />

          <div className="sticky bottom-0 z-10 -mx-4 mt-2 px-4 pb-5 pt-4 sm:-mx-5 sm:px-5 sm:pb-6 flex items-center gap-2 flex-wrap rounded-b-[19px] bg-ink-900">
            <button
              type="button"
              onClick={() => onDraft('reply')}
              className="h-9 px-4 rounded-full border border-fg/[0.09] flex items-center gap-2 text-sm font-medium text-fg/65 transition-colors hover:border-fg/20 hover:bg-fg/[0.035] hover:text-fg active:scale-95"
            >
              <ReplyGlyph className="w-4 h-4" />
              Reply
            </button>
            {others.length > 1 && (
              <button
                type="button"
                onClick={() => onDraft('reply-all')}
                className="h-9 px-4 rounded-full border border-fg/[0.09] flex items-center gap-2 text-sm font-medium text-fg/65 transition-colors hover:border-fg/20 hover:bg-fg/[0.035] hover:text-fg active:scale-95"
              >
                <ReplyAllGlyph className="w-4 h-4" />
                Reply all
              </button>
            )}
            <button
              type="button"
              onClick={() => onDraft('forward')}
              className="h-9 px-4 rounded-full border border-fg/[0.09] flex items-center gap-2 text-sm font-medium text-fg/65 transition-colors hover:border-fg/20 hover:bg-fg/[0.035] hover:text-fg active:scale-95"
            >
              <ForwardGlyph className="w-4 h-4" />
              Forward
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

function ReaderSkeleton() {
  return (
    <div className="max-w-[760px] mx-auto px-6 pt-10 space-y-7">
      <Skeleton className="w-3/5 h-6 rounded-full" />
      <div className="flex gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="w-1/3 h-3 rounded-full" />
          <Skeleton className="w-2/3 h-3 rounded-full" />
        </div>
      </div>
      <Skeleton className="w-full h-52 rounded-card" />
    </div>
  )
}

export default function Reader({
  thread,
  loading,
  onBack
}: {
  thread: MailThread | null
  loading: boolean
  onBack?: () => void
}) {
  const accounts = useMail(state => state.accounts)
  const setThreads = useMail(state => state.setThreads)
  const makeDraft = useMail(state => state.makeDraft)
  const print = useMail(state => state.print)
  const snooze = useMail(state => state.snooze)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState(false)
  const [menuScreen, setMenuScreen] = useState<'main' | 'snooze'>('main')
  const [snoozeAt, setSnoozeAt] = useState(() => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
    date.setMinutes(0, 0, 0)
    return date.toISOString().slice(0, 16)
  })

  useEffect(() => {
    setExpanded(new Set(thread?.messages.at(-1)?.id ? [thread.messages.at(-1)!.id] : []))
  }, [thread?.id])

  if (loading) return <ReaderSkeleton />
  if (!thread) {
    return <Empty icon={<MailGlyph className="w-8 h-8 text-fg-faint" />} label="Choose a conversation" />
  }

  const account = accounts.find(one => one.id === thread.accountId)
  const latest = thread.messages.at(-1)

  const change = async (patch: MailThreadStatePatch) => {
    const error = await setThreads(thread.accountId, [thread.id], patch)
    if (error) toast.fail(error)
  }

  const snoozeNow = async () => {
    const error = await snooze(thread.accountId, thread.id, new Date(snoozeAt).getTime())
    if (error) toast.fail(error)
    else {
      setMenu(false)
      setMenuScreen('main')
      toast.done('Conversation snoozed.')
    }
  }

  const draft = (message: MailMessage, mode: 'reply' | 'reply-all' | 'forward') => {
    if (mode === 'forward') {
      makeDraft(thread.accountId, {
        subject: replySubject(message.subject || thread.subject, 'Fwd'),
        text: `${account?.signature ?? ''}${forwardText(message)}`,
        forwardOf: message.id,
        attachments: message.attachments
      })
      return
    }
    const mine = account?.email.toLowerCase()
    const to = mode === 'reply-all'
      ? unique([message.from, ...message.to]).filter(address => address.email.toLowerCase() !== mine)
      : [message.from]
    const cc = mode === 'reply-all'
      ? unique(message.cc).filter(address => address.email.toLowerCase() !== mine)
      : []
    makeDraft(thread.accountId, {
      to,
      cc,
      subject: replySubject(message.subject || thread.subject, 'Re'),
      replyTo: message.id
    })
  }

  return (
    <section className="h-full min-h-0 flex flex-col relative bg-ink-900">
      <div className="h-16 shrink-0 px-3 flex items-end pb-2 border-b border-fg/[0.06]">
        <div className="flex-1 min-w-0 flex items-center gap-1">
          {onBack && (
            <IconButton label="Back" onClick={onBack}>
              <ChevronLeftGlyph className="w-4 h-4" />
            </IconButton>
          )}
          <IconButton label="Archive" onClick={() => void change({ mailboxId: 'all' })}>
            <ArchiveGlyph className="w-4 h-4" />
          </IconButton>
          <IconButton label="Move to trash" onClick={() => void change({ mailboxId: 'trash' })}>
            <TrashGlyph className="w-4 h-4" />
          </IconButton>
          <IconButton label="Mark unread" onClick={() => void change({ read: false })}>
            <UnreadGlyph className="w-4 h-4" />
          </IconButton>
          <span className="flex-1" />
          <IconButton label={thread.starred ? 'Unstar' : 'Star'} onClick={() => void change({ starred: !thread.starred })}>
            <StarGlyph className="w-4 h-4" />
          </IconButton>
          <span className="relative">
            <IconButton
              label="More"
              onClick={() => {
                setMenuScreen('main')
                setMenu(value => !value)
              }}
            >
              <MoreGlyph className="w-4 h-4" />
            </IconButton>
            <Popover open={menu} onClose={() => setMenu(false)} className={menuScreen === 'snooze' ? 'w-72' : ''}>
              {menuScreen === 'snooze' ? (
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => setMenuScreen('main')}
                    className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg/50 transition-colors hover:text-fg"
                  >
                    <ChevronLeftGlyph className="w-3.5 h-3.5" />
                    Snooze
                  </button>
                  <input
                    type="datetime-local"
                    aria-label="Snooze until"
                    value={snoozeAt}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={event => setSnoozeAt(event.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-fg/[0.07] text-sm text-fg outline-none focus:bg-fg/[0.11]"
                  />
                  <button
                    type="button"
                    onClick={() => void snoozeNow()}
                    disabled={!snoozeAt || new Date(snoozeAt).getTime() <= Date.now()}
                    className="w-full h-9 mt-2 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-colors hover:bg-fg/90 active:scale-[0.98] disabled:opacity-40"
                  >
                    Snooze
                  </button>
                </div>
              ) : (
                <>
                  <MenuItem icon={<SpamGlyph />} label="Move to spam" onClick={() => void change({ mailboxId: 'spam' })} />
                  <MenuItem icon={<ClockGlyph />} label="Snooze" into onClick={() => setMenuScreen('snooze')} />
                  {account && account.labels.length > 0 && (
                    <SubMenu icon={<LabelGlyph />} label="Labels">
                      {account.labels.map(label => {
                        const checked = thread.labelIds.includes(label.id)
                        return (
                          <MenuItem
                            key={label.id}
                            label={label.name}
                            checked={checked}
                            onClick={() => void change(checked ? { removeLabelId: label.id } : { addLabelId: label.id })}
                          />
                        )
                      })}
                    </SubMenu>
                  )}
                  <MenuDivider />
                  <MenuItem
                    icon={<FileGlyph />}
                    label="Print"
                    onClick={() => {
                      setMenu(false)
                      void print().then(error => error && toast.fail(error))
                    }}
                  />
                  {latest && (
                    <>
                      <MenuDivider />
                      <MenuItem icon={<ReplyGlyph />} label="Reply" onClick={() => draft(latest, 'reply')} />
                      <MenuItem icon={<ReplyAllGlyph />} label="Reply all" onClick={() => draft(latest, 'reply-all')} />
                      <MenuItem icon={<ForwardGlyph />} label="Forward" onClick={() => draft(latest, 'forward')} />
                    </>
                  )}
                </>
              )}
            </Popover>
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="max-w-[780px] mx-auto px-5 sm:px-7 pt-8 pb-32">
          <h1 className="text-xl font-semibold leading-7 text-fg select-text">{thread.subject || '(no subject)'}</h1>
          <div className="mt-7 space-y-2">
            {thread.messages.map(message => (
              <Message
                key={message.id}
                message={message}
                accountId={thread.accountId}
                accountEmail={account?.email ?? ''}
                expanded={expanded.has(message.id)}
                onToggle={() =>
                  setExpanded(current => {
                    const next = new Set(current)
                    if (next.has(message.id)) next.delete(message.id)
                    else next.add(message.id)
                    return next
                  })
                }
                onDraft={mode => draft(message, mode)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
