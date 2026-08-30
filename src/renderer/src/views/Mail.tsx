import { useEffect, useMemo, useRef, useState } from 'react'
import type { MailThreadQuery, MailThreadSummary } from '../state/mail'
import { mailApiAvailable, useMail, watchMail } from '../state/mail'
import { RefreshGlyph, SignalGlyph } from '../icons'
import Empty from '../components/Empty'
import Spinner from '../components/Spinner'
import MailSidebar, { type MailLocation } from '../components/mail/Sidebar'
import ThreadList from '../components/mail/ThreadList'
import Reader from '../components/mail/Reader'
import DraftDeck from '../components/mail/Compose'
import MailSetup from '../components/mail/Setup'

type Layout = 'wide' | 'middle' | 'narrow'
type NarrowScreen = 'mailboxes' | 'list' | 'reader'

const layoutFor = (width: number): Layout => (width >= 980 ? 'wide' : width >= 680 ? 'middle' : 'narrow')

export default function Mail() {
  const root = useRef<HTMLDivElement>(null)
  const accounts = useMail(state => state.accounts)
  const threads = useMail(state => state.threads)
  const thread = useMail(state => state.openThread)
  const loading = useMail(state => state.loading)
  const syncing = useMail(state => state.syncing)
  const threadLoading = useMail(state => state.threadLoading)
  const ready = useMail(state => state.ready)
  const online = useMail(state => state.online)
  const issue = useMail(state => state.issue)
  const load = useMail(state => state.load)
  const refresh = useMail(state => state.refresh)
  const showThread = useMail(state => state.showThread)
  const closeThread = useMail(state => state.closeThread)
  const makeDraft = useMail(state => state.makeDraft)
  const [layout, setLayout] = useState<Layout>(() => layoutFor(window.innerWidth))
  const [screen, setScreen] = useState<NarrowScreen>('list')
  const [location, setLocation] = useState<MailLocation>({ mailboxId: 'inbox' })
  const [query, setQuery] = useState('')

  const request = useMemo<MailThreadQuery>(
    () => ({
      accountId: location.accountId,
      mailboxId: location.mailboxId,
      labelId: location.labelId,
      query: query.trim() || undefined
    }),
    [location.accountId, location.labelId, location.mailboxId, query]
  )

  useEffect(() => {
    const node = root.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => setLayout(layoutFor(entries[0]?.contentRect.width ?? window.innerWidth)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => watchMail(), [])

  useEffect(() => {
    if (!query) {
      void load(request)
      return
    }
    const timer = window.setTimeout(() => void load(request), 180)
    return () => window.clearTimeout(timer)
  }, [load, request, query])

  useEffect(() => {
    if (layout === 'wide') return
    setScreen(thread ? 'reader' : 'list')
  }, [layout, thread?.id])

  const locate = (next: MailLocation) => {
    setLocation(next)
    setQuery('')
    closeThread()
    setScreen('list')
  }

  const open = (summary: MailThreadSummary) => {
    void showThread(summary.accountId, summary.id)
    setScreen('reader')
  }

  const compose = () => {
    const accountId = location.accountId ?? accounts[0]?.id
    if (accountId) makeDraft(accountId)
  }

  const list = (narrow: boolean, onBack: () => void) => (
    <ThreadList
      accounts={accounts}
      threads={threads}
      location={location}
      query={query}
      loading={loading}
      syncing={syncing}
      activeId={thread ? `${thread.accountId}:${thread.id}` : undefined}
      narrow={narrow}
      onQuery={setQuery}
      onOpen={open}
      onBack={onBack}
      onRefresh={() => void refresh(request)}
    />
  )

  if (!ready) {
    return (
      <div ref={root} className="h-full flex items-center justify-center text-fg-muted">
        <Spinner size={20} />
      </div>
    )
  }

  if (ready && !mailApiAvailable() && accounts.length === 0) {
    return (
      <div ref={root} className="h-full relative">
        <Empty
          icon={<SignalGlyph className="w-8 h-8 text-fg-faint" />}
          label="Mail is unavailable"
          detail="Restart Crew and try again."
        />
      </div>
    )
  }

  if (ready && accounts.length === 0) return <MailSetup />

  return (
    <div ref={root} className="h-full min-w-0 relative overflow-hidden bg-ink-900">
      {layout === 'wide' && (
        <div className="h-full flex">
          <div className="w-[236px] shrink-0">
            <MailSidebar accounts={accounts} location={location} onLocation={locate} onCompose={compose} />
          </div>
          <div className="w-[360px] shrink-0">{list(false, () => {})}</div>
          <div className="min-w-0 flex-1 relative">
            <Reader thread={thread} loading={threadLoading} />
          </div>
        </div>
      )}

      {layout === 'middle' && (
        <div className="h-full flex">
          <div className="w-[226px] shrink-0">
            <MailSidebar accounts={accounts} location={location} onLocation={locate} onCompose={compose} />
          </div>
          <div className="min-w-0 flex-1 relative">
            {screen === 'reader' ? (
              <Reader
                thread={thread}
                loading={threadLoading}
                onBack={() => {
                  closeThread()
                  setScreen('list')
                }}
              />
            ) : (
              list(false, () => {})
            )}
          </div>
        </div>
      )}

      {layout === 'narrow' && (
        <div className="h-full relative">
          {screen === 'mailboxes' && (
            <div className="absolute inset-0">
              <MailSidebar
                accounts={accounts}
                location={location}
                onLocation={locate}
                onCompose={compose}
                onBack={() => setScreen('list')}
              />
            </div>
          )}
          {screen === 'list' && list(true, () => setScreen('mailboxes'))}
          {screen === 'reader' && (
            <Reader
              thread={thread}
              loading={threadLoading}
              onBack={() => {
                closeThread()
                setScreen('list')
              }}
            />
          )}
        </div>
      )}

      {!online && (
        <div className="absolute z-40 left-1/2 -translate-x-1/2 top-14 h-8 px-3 rounded-full glass flex items-center gap-2 text-xs font-medium text-fg/70 shadow-lg">
          <SignalGlyph className="w-3.5 h-3.5" />
          Offline
        </div>
      )}

      {issue && mailApiAvailable() && (
        <div className="absolute z-40 left-1/2 -translate-x-1/2 top-14 max-w-[calc(100%-24px)] min-h-8 px-3 py-1.5 rounded-full glass flex items-center gap-2 text-xs text-fg/70 shadow-lg">
          <span className="truncate">{issue}</span>
          <button
            type="button"
            onClick={() => void refresh(request)}
            className="shrink-0 flex items-center gap-1.5 font-semibold text-fg transition-opacity hover:opacity-80 active:scale-95"
          >
            <RefreshGlyph className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      <DraftDeck narrow={layout === 'narrow'} />
    </div>
  )
}
