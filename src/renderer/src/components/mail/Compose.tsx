import { useEffect, useMemo, useRef, useState } from 'react'
import type { MailAddress, MailDraft } from '../../state/mail'
import { useMail } from '../../state/mail'
import {
  AttachmentGlyph,
  ChevronDownGlyph,
  CloseGlyph,
  MinusGlyph,
  SendGlyph,
  TrashGlyph
} from '../../icons'
import { Popover } from '../Popover'
import Select from '../Select'
import Spinner from '../Spinner'
import Tooltip from '../Tooltip'
import { toast } from '../../state/toast'
import RecipientField from './Recipients'
import RichEditor from './RichEditor'
import { fileSize, IconButton } from './parts'

function ComposeCard({ draft, suggestions, narrow }: { draft: MailDraft; suggestions: MailAddress[]; narrow: boolean }) {
  const accounts = useMail(state => state.accounts)
  const changeDraft = useMail(state => state.changeDraft)
  const saveDraft = useMail(state => state.saveDraft)
  const discardDraft = useMail(state => state.discardDraft)
  const sendDraft = useMail(state => state.sendDraft)
  const attach = useMail(state => state.attach)
  const file = useRef<HTMLInputElement>(null)
  const [more, setMore] = useState(draft.cc.length > 0 || draft.bcc.length > 0)
  const [sendLater, setSendLater] = useState(false)
  const [when, setWhen] = useState(() => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000)
    date.setMinutes(0, 0, 0)
    return date.toISOString().slice(0, 16)
  })
  const account = accounts.find(one => one.id === draft.accountId)

  useEffect(() => {
    if (draft.saved || draft.saving || draft.sending) return
    const timer = window.setTimeout(() => void saveDraft(draft.id), 900)
    return () => window.clearTimeout(timer)
  }, [draft, saveDraft])

  const updateRecipients = (kind: 'to' | 'cc' | 'bcc', value: MailAddress[]) => changeDraft(draft.id, { [kind]: value })

  const send = async (sendAt?: string) => {
    const error = await sendDraft(draft.id, sendAt)
    if (error) toast.fail(error)
    else toast.done(sendAt ? 'Message scheduled.' : 'Message sent.')
  }

  const addFile = async (picked: File) => {
    const error = await attach(draft.id, picked)
    if (error) toast.fail(error)
  }

  const width = narrow ? 'w-full' : 'w-[560px]'

  return (
    <section className={`${width} mail-compose-surface h-[min(640px,calc(100vh-88px))] max-h-[calc(100vh-88px)] glass glass-strong rounded-card overflow-hidden flex flex-col animate-rise`}>
      <header className="h-12 shrink-0 pl-4 pr-2.5 flex items-center gap-1.5 border-b border-fg/[0.06]">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
          {draft.replyTo ? 'Reply' : draft.forwardOf ? 'Forward' : 'New message'}
        </span>
        <span className="mr-1 text-[11px] text-fg/40">
          {draft.saving ? 'Saving' : draft.saved ? 'Saved' : draft.problem ? 'Not saved' : ''}
        </span>
        <IconButton label="Minimize" onClick={() => changeDraft(draft.id, { minimized: true })}>
          <MinusGlyph className="w-[15px] h-[15px]" />
        </IconButton>
        <IconButton label="Discard" onClick={() => void discardDraft(draft.id)}>
          <TrashGlyph className="w-[15px] h-[15px]" />
        </IconButton>
      </header>

      {accounts.length > 1 && (
        <div className="min-h-12 shrink-0 px-4 py-2 border-b border-fg/[0.06] flex items-center gap-2">
          <span className="w-11 shrink-0 text-xs text-fg/40">From</span>
          {draft.attachments.length > 0 ? (
            <Tooltip label="Remove attachments to change accounts." className="min-w-0 flex-1">
              <button
                type="button"
                aria-label={`From ${account?.displayName ?? ''} ${account?.email ?? ''}. Remove attachments to change accounts.`}
                className="w-full min-w-0 h-8 px-3 rounded-full bg-fg/[0.07] text-sm font-medium text-fg/45 truncate text-left"
              >
                {account?.displayName} · {account?.email}
              </button>
            </Tooltip>
          ) : (
            <Select
              value={draft.accountId}
              options={accounts.map(one => ({ value: one.id, label: `${one.displayName} · ${one.email}` }))}
              onChange={accountId => changeDraft(draft.id, { accountId })}
              full
            />
          )}
        </div>
      )}

      <RecipientField
        label="To"
        recipients={draft.to}
        suggestions={suggestions}
        onChange={value => updateRecipients('to', value)}
        autoFocus={!draft.replyTo && !draft.forwardOf}
      />
      <div className="relative">
        {!more && (
          <button
            type="button"
            onClick={() => setMore(true)}
            className="absolute right-3 -top-10 h-8 px-2.5 rounded-full text-xs text-fg/40 transition-[background-color,color,transform] hover:bg-fg/[0.06] hover:text-fg/75 active:scale-95"
          >
            Cc&nbsp;&nbsp;Bcc
          </button>
        )}
      </div>
      {more && (
        <>
          <RecipientField label="Cc" recipients={draft.cc} suggestions={suggestions} onChange={value => updateRecipients('cc', value)} />
          <RecipientField label="Bcc" recipients={draft.bcc} suggestions={suggestions} onChange={value => updateRecipients('bcc', value)} />
        </>
      )}

      <div className="h-12 shrink-0 px-4 border-b border-fg/[0.06] flex items-center gap-2">
        <span className="w-11 shrink-0 text-xs text-fg/40">Subject</span>
        <input
          value={draft.subject}
          onChange={event => changeDraft(draft.id, { subject: event.target.value })}
          aria-label="Subject"
          className="min-w-0 flex-1 h-10 bg-transparent text-sm text-fg outline-none"
        />
      </div>

      <RichEditor
        draftId={draft.id}
        html={draft.html}
        text={draft.text}
        autoFocus={Boolean(draft.replyTo)}
        onChange={value => changeDraft(draft.id, value)}
      />

      {draft.attachments.length > 0 && (
        <div className="shrink-0 max-h-24 overflow-y-auto px-4 py-2.5 border-t border-fg/[0.06] flex flex-wrap gap-1.5">
          {draft.attachments.map(attachment => (
            <span
              key={attachment.id}
              className="max-w-52 h-7 pl-2.5 pr-1 rounded-full bg-fg/[0.06] flex items-center gap-1.5 text-xs text-fg/60"
            >
              <AttachmentGlyph className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{attachment.name}</span>
              <span className="text-fg/25 shrink-0">{fileSize(attachment.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${attachment.name}`}
                onClick={() =>
                  changeDraft(draft.id, { attachments: draft.attachments.filter(one => one.id !== attachment.id) })
                }
                className="w-5 h-5 rounded-full flex items-center justify-center text-fg/30 transition-colors hover:text-fg active:scale-90"
              >
                <CloseGlyph className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {draft.problem && <div className="shrink-0 px-4 py-2 text-xs text-danger bg-danger/10">{draft.problem} Try again.</div>}

      <footer className="h-14 shrink-0 px-3.5 py-2.5 border-t border-fg/[0.06] flex items-center gap-2">
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => void send()}
            disabled={draft.sending}
            className="h-9 pl-4 pr-3.5 rounded-l-full bg-fg text-ink-900 flex items-center gap-2 text-sm font-semibold transition-colors hover:bg-fg/90 active:scale-[0.98] disabled:opacity-40"
          >
            {draft.sending ? <Spinner size={15} /> : <SendGlyph className="w-4 h-4" />}
            Send
          </button>
          <button
            type="button"
            aria-label="Send later"
            onClick={() => setSendLater(value => !value)}
            className="w-8 h-9 rounded-r-full bg-fg text-ink-900 flex items-center justify-center border-l border-ink-900/15 transition-colors hover:bg-fg/90 active:scale-[0.98]"
          >
            <ChevronDownGlyph className="w-3.5 h-3.5" />
          </button>
          <Popover open={sendLater} onClose={() => setSendLater(false)} side="top" align="start" className="w-72">
            <div className="p-2">
              <label className="block px-1 pb-2 text-xs font-medium text-fg/45">Send on</label>
              <p className="px-1 pb-2 text-xs text-fg/45">Crew must be open then.</p>
              <input
                type="datetime-local"
                value={when}
                min={new Date().toISOString().slice(0, 16)}
                onChange={event => setWhen(event.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-fg/[0.07] text-sm text-fg outline-none focus:bg-fg/[0.11]"
              />
              <button
                type="button"
                onClick={() => {
                  setSendLater(false)
                  void send(new Date(when).toISOString())
                }}
                disabled={!when || new Date(when).getTime() <= Date.now()}
                className="w-full h-9 mt-2 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-colors hover:bg-fg/90 active:scale-[0.98] disabled:opacity-40"
              >
                Schedule
              </button>
            </div>
          </Popover>
        </div>
        <input
          ref={file}
          type="file"
          multiple
          className="hidden"
          onChange={event => {
            for (const picked of [...(event.target.files ?? [])]) void addFile(picked)
            event.target.value = ''
          }}
        />
        <IconButton label="Attach files" onClick={() => file.current?.click()}>
          <AttachmentGlyph className="w-[17px] h-[17px]" />
        </IconButton>
        <span className="flex-1" />
        {account && <span className="max-w-48 truncate text-[11px] text-fg/35">{account.email}</span>}
      </footer>
    </section>
  )
}

export default function DraftDeck({ narrow }: { narrow: boolean }) {
  const drafts = useMail(state => state.drafts)
  const threads = useMail(state => state.threads)
  const changeDraft = useMail(state => state.changeDraft)
  const suggestions = useMemo(() => {
    const seen = new Set<string>()
    const addresses: MailAddress[] = []
    for (const thread of threads) {
      for (const address of thread.participants) {
        const key = address.email.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        addresses.push(address)
      }
    }
    return addresses
  }, [threads])

  if (drafts.length === 0) return null

  return (
    <div className="mail-compose-shadow absolute z-50 inset-x-8 bottom-8 pointer-events-none">
      <div className="flex items-end justify-end gap-2 overflow-x-auto">
        {drafts.map(draft =>
          draft.minimized ? (
            <button
              key={draft.id}
              type="button"
              onClick={() => changeDraft(draft.id, { minimized: false })}
              className="mail-compose-surface pointer-events-auto w-56 h-11 px-4 rounded-full glass glass-strong flex items-center gap-2 text-sm font-medium text-fg/75 transition-colors hover:text-fg active:scale-[0.98]"
            >
              <span className="min-w-0 flex-1 truncate text-left">{draft.subject || 'New message'}</span>
              {draft.sending && <Spinner size={14} />}
            </button>
          ) : (
            <div key={draft.id} className="pointer-events-auto shrink-0 max-w-full">
              <ComposeCard draft={draft} suggestions={suggestions} narrow={narrow} />
            </div>
          )
        )}
      </div>
    </div>
  )
}
