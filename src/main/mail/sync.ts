import type { MailProvider } from '../../shared/mail'

export interface RemoteMailbox {
  id: string
  name: string
  role?: string
}

export interface RemoteMailboxStatus {
  uidValidity: string
  uidNext: number
  highestModSeq?: string
}

export interface RemoteMailMessage {
  id?: string
  mailboxId: string
  uid: number
  internalDate: number
  flags: string[]
  subject?: string
  from?: string
  to?: string[]
  cc?: string[]
  messageId?: string
  gmailMessageId?: string
  threadId?: string
  size?: number
  preview?: string
  body?: string
  bodyHtml?: string
  labelIds?: string[]
  participants?: Array<{ role: 'from' | 'sender' | 'reply-to' | 'to' | 'cc' | 'bcc'; email: string; name?: string }>
  attachments?: Array<{
    id: string
    filename: string
    contentType: string
    size: number
    contentId?: string
    inline?: boolean
    checksum?: string
    content?: Uint8Array
  }>
  modSeq?: string
}

export interface MailboxFetchRequest {
  limit: number
  body: boolean
  descending?: boolean
  afterUid?: number
  beforeUid?: number
  changedSince?: string
}

export interface MailboxFetchResult {
  messages: RemoteMailMessage[]
  vanishedUids?: number[]
  highestModSeq?: string
  scannedThroughUid?: number
  nextBeforeUid?: number
}

export interface MailSyncTransport {
  readonly provider: MailProvider
  listMailboxes(signal?: AbortSignal): Promise<RemoteMailbox[]>
  mailboxStatus(mailboxId: string, signal?: AbortSignal): Promise<RemoteMailboxStatus>
  fetchMessages(
    mailboxId: string,
    request: MailboxFetchRequest,
    signal?: AbortSignal
  ): Promise<MailboxFetchResult>
  fetchBody(mailboxId: string, uid: number, signal?: AbortSignal): Promise<RemoteMailMessage>
  searchGmail?(query: string, signal?: AbortSignal): Promise<RemoteMailMessage[]>
  idle(signal: AbortSignal, changed: () => void): Promise<void>
  close(): void | Promise<void>
}

export interface MailboxSyncState {
  accountId: string
  mailboxId: string
  uidValidity: string
  lastUid: number
  hydratedFromUid: number
  highestModSeq?: string
  fullyHydrated: boolean
  syncedAt: number
}

export interface StoredMailBody {
  body: string
}

export interface MailSyncStore {
  putMailboxes(accountId: string, mailboxes: RemoteMailbox[]): void | Promise<void>
  getSyncState(accountId: string, mailboxId: string): MailboxSyncState | null | Promise<MailboxSyncState | null>
  putSyncState(state: MailboxSyncState): void | Promise<void>
  resetMailbox(accountId: string, mailboxId: string): void | Promise<void>
  putMessages(
    accountId: string,
    messages: RemoteMailMessage[],
    options: { dedupeByGmailMessageId: boolean }
  ): void | Promise<void>
  removeMessagesByUid(accountId: string, mailboxId: string, uids: number[]): void | Promise<void>
  getMessageBody(accountId: string, mailboxId: string, uid: number): StoredMailBody | null | Promise<StoredMailBody | null>
}

export type MailSyncEvent =
  | { type: 'sync:start'; accountId: string }
  | { type: 'sync:recent'; accountId: string; mailboxId: string; count: number }
  | { type: 'sync:mailbox'; accountId: string; mailboxId: string; count: number }
  | { type: 'sync:complete'; accountId: string }
  | { type: 'connection'; accountId: string; connected: boolean; error?: string }
  | { type: 'change'; accountId: string }

export interface MailSynchronizerOptions {
  accountId: string
  transport: MailSyncTransport
  store: MailSyncStore
  onEvent?: (event: MailSyncEvent) => void
  clock?: () => number
  recentLimit?: number
  pageSize?: number
  backfillLimit?: number
  maxIdleReconnects?: number
  reconnectBaseMs?: number
  reconnectMaxMs?: number
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function uniqueMessages(messages: RemoteMailMessage[], gmail: boolean): RemoteMailMessage[] {
  const seen = new Set<string>()
  const result: RemoteMailMessage[] = []
  for (const message of messages) {
    const key = gmail && message.gmailMessageId
      ? `gmail:${message.gmailMessageId}`
      : `${message.mailboxId}:${message.uid}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(message)
  }
  return result
}

function latestUid(messages: RemoteMailMessage[], fallback: number): number {
  return messages.reduce((last, message) => Math.max(last, message.uid), fallback)
}

function earliestUid(messages: RemoteMailMessage[], fallback: number): number {
  return messages.reduce((first, message) => Math.min(first, message.uid), fallback)
}

function abortError(): Error {
  const error = new Error('Mail sync stopped')
  error.name = 'AbortError'
  return error
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms)
    function done(): void {
      signal.removeEventListener('abort', stopped)
      resolve()
    }
    function stopped(): void {
      clearTimeout(timer)
      signal.removeEventListener('abort', stopped)
      reject(abortError())
    }
    signal.addEventListener('abort', stopped, { once: true })
  })
}

export class MailSynchronizer {
  readonly accountId: string
  private readonly transport: MailSyncTransport
  private readonly store: MailSyncStore
  private readonly onEvent?: (event: MailSyncEvent) => void
  private readonly clock: () => number
  private readonly recentLimit: number
  private readonly pageSize: number
  private readonly backfillLimit: number
  private readonly maxIdleReconnects: number
  private readonly reconnectBaseMs: number
  private readonly reconnectMaxMs: number
  private abort = new AbortController()
  private syncTail: Promise<void> = Promise.resolve()
  private idleTask: Promise<void> | null = null
  private stopped = false

  constructor(options: MailSynchronizerOptions) {
    this.accountId = options.accountId
    this.transport = options.transport
    this.store = options.store
    this.onEvent = options.onEvent
    this.clock = options.clock ?? Date.now
    this.recentLimit = Math.max(1, options.recentLimit ?? 50)
    this.pageSize = Math.max(this.recentLimit, options.pageSize ?? 250)
    this.backfillLimit = Math.max(this.pageSize, options.backfillLimit ?? 2_000)
    this.maxIdleReconnects = Math.max(0, options.maxIdleReconnects ?? 8)
    this.reconnectBaseMs = Math.max(100, options.reconnectBaseMs ?? 1_000)
    this.reconnectMaxMs = Math.max(this.reconnectBaseMs, options.reconnectMaxMs ?? 60_000)
  }

  sync(): Promise<void> {
    if (this.stopped) return Promise.reject(new Error('Mail synchronizer is stopped'))
    const run = () => this.syncNow()
    const next = this.syncTail.then(run, run)
    this.syncTail = next.catch(() => undefined)
    return next
  }

  startIdle(): Promise<void> {
    if (this.stopped) return Promise.reject(new Error('Mail synchronizer is stopped'))
    if (!this.idleTask) this.idleTask = this.idleLoop().finally(() => (this.idleTask = null))
    return this.idleTask
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    this.abort.abort()
    await Promise.allSettled([this.syncTail, this.idleTask ?? Promise.resolve()])
    await this.transport.close()
  }

  async fetchBody(mailboxId: string, uid: number): Promise<StoredMailBody> {
    if (this.stopped) throw new Error('Mail synchronizer is stopped')
    const cached = await this.store.getMessageBody(this.accountId, mailboxId, uid)
    if (cached) return cached
    const message = await this.transport.fetchBody(mailboxId, uid, this.abort.signal)
    if (message.mailboxId !== mailboxId || message.uid !== uid || message.body === undefined) {
      throw new Error('Mail server returned the wrong message body')
    }
    await this.putMessages([message])
    return { body: message.body }
  }

  async searchGmail(query: string): Promise<RemoteMailMessage[]> {
    if (this.stopped) throw new Error('Mail synchronizer is stopped')
    if (this.transport.provider !== 'gmail' || !this.transport.searchGmail) {
      throw new Error('Remote search is only available for Gmail accounts')
    }
    const clean = query.trim()
    if (!clean) return []
    const messages = uniqueMessages(await this.transport.searchGmail(clean, this.abort.signal), true)
    await this.putMessages(messages)
    return messages
  }

  private async syncNow(): Promise<void> {
    if (this.abort.signal.aborted) throw abortError()
    this.onEvent?.({ type: 'sync:start', accountId: this.accountId })
    const mailboxes = await this.transport.listMailboxes(this.abort.signal)
    await this.store.putMailboxes(this.accountId, mailboxes)
    for (const mailbox of mailboxes) {
      if (this.abort.signal.aborted) throw abortError()
      await this.syncMailbox(mailbox)
    }
    this.onEvent?.({ type: 'sync:complete', accountId: this.accountId })
  }

  private async syncMailbox(mailbox: RemoteMailbox): Promise<void> {
    const status = await this.transport.mailboxStatus(mailbox.id, this.abort.signal)
    let state = await this.store.getSyncState(this.accountId, mailbox.id)
    if (state && state.uidValidity !== status.uidValidity) {
      await this.store.resetMailbox(this.accountId, mailbox.id)
      state = null
    }
    if (!state) {
      state = await this.hydrateRecent(mailbox, status)
    } else {
      state = await this.incremental(mailbox, status, state)
    }
    if (!state.fullyHydrated) await this.backfill(mailbox, status, state)
  }

  private async hydrateRecent(
    mailbox: RemoteMailbox,
    status: RemoteMailboxStatus
  ): Promise<MailboxSyncState> {
    const fetched = await this.transport.fetchMessages(
      mailbox.id,
      {
        limit: this.recentLimit,
        body: false,
        descending: true,
        beforeUid: status.uidNext
      },
      this.abort.signal
    )
    await this.applyFetch(mailbox.id, fetched)
    const lastUid = latestUid(fetched.messages, Math.max(0, status.uidNext - 1))
    const hydratedFromUid = Math.min(
      earliestUid(fetched.messages, status.uidNext),
      fetched.nextBeforeUid ?? status.uidNext
    )
    const state: MailboxSyncState = {
      accountId: this.accountId,
      mailboxId: mailbox.id,
      uidValidity: status.uidValidity,
      lastUid,
      hydratedFromUid,
      highestModSeq: fetched.highestModSeq ?? status.highestModSeq,
      fullyHydrated: fetched.nextBeforeUid === undefined
        ? fetched.messages.length < this.recentLimit || hydratedFromUid <= 1
        : hydratedFromUid <= 1,
      syncedAt: this.clock()
    }
    await this.store.putSyncState(state)
    this.onEvent?.({
      type: 'sync:recent',
      accountId: this.accountId,
      mailboxId: mailbox.id,
      count: fetched.messages.length
    })
    return state
  }

  private async incremental(
    mailbox: RemoteMailbox,
    status: RemoteMailboxStatus,
    state: MailboxSyncState
  ): Promise<MailboxSyncState> {
    if (state.highestModSeq && status.highestModSeq) {
      try {
        const fetched = await this.transport.fetchMessages(
          mailbox.id,
          {
            limit: this.pageSize,
            body: false,
            changedSince: state.highestModSeq
          },
          this.abort.signal
        )
        await this.applyFetch(mailbox.id, fetched)
        const updated: MailboxSyncState = {
          ...state,
          lastUid: latestUid(fetched.messages, state.lastUid),
          highestModSeq: fetched.highestModSeq ?? status.highestModSeq,
          syncedAt: this.clock()
        }
        await this.store.putSyncState(updated)
        this.onEvent?.({
          type: 'sync:mailbox',
          accountId: this.accountId,
          mailboxId: mailbox.id,
          count: fetched.messages.length
        })
        return updated
      } catch (error) {
        if (this.abort.signal.aborted) throw error
      }
    }
    return this.incrementalByUid(mailbox, status, state)
  }

  private async incrementalByUid(
    mailbox: RemoteMailbox,
    status: RemoteMailboxStatus,
    initial: MailboxSyncState
  ): Promise<MailboxSyncState> {
    let state = initial
    let afterUid = state.lastUid
    let count = 0
    while (afterUid < status.uidNext - 1) {
      const fetched = await this.transport.fetchMessages(
        mailbox.id,
        {
          limit: this.pageSize,
          body: false,
          descending: false,
          afterUid
        },
        this.abort.signal
      )
      await this.applyFetch(mailbox.id, fetched)
      count += fetched.messages.length
      const nextUid = Math.max(latestUid(fetched.messages, afterUid), fetched.scannedThroughUid ?? afterUid)
      state = {
        ...state,
        lastUid: nextUid,
        highestModSeq: fetched.highestModSeq ?? status.highestModSeq,
        syncedAt: this.clock()
      }
      await this.store.putSyncState(state)
      if (nextUid <= afterUid) break
      afterUid = nextUid
    }
    if (afterUid >= status.uidNext - 1 && state.lastUid !== afterUid) {
      state = { ...state, lastUid: afterUid, syncedAt: this.clock() }
      await this.store.putSyncState(state)
    }
    this.onEvent?.({ type: 'sync:mailbox', accountId: this.accountId, mailboxId: mailbox.id, count })
    return state
  }

  private async backfill(
    mailbox: RemoteMailbox,
    status: RemoteMailboxStatus,
    initial: MailboxSyncState
  ): Promise<void> {
    let state = initial
    let taken = 0
    while (!state.fullyHydrated && !this.abort.signal.aborted && taken < this.backfillLimit) {
      const beforeUid = state.hydratedFromUid
      const fetched = await this.transport.fetchMessages(
        mailbox.id,
        {
          limit: this.pageSize,
          body: false,
          descending: true,
          beforeUid
        },
        this.abort.signal
      )
      await this.applyFetch(mailbox.id, fetched)
      taken += fetched.messages.length
      const hydratedFromUid = Math.min(earliestUid(fetched.messages, beforeUid), fetched.nextBeforeUid ?? beforeUid)
      const fullyHydrated = hydratedFromUid <= 1
      state = {
        ...state,
        uidValidity: status.uidValidity,
        lastUid: latestUid(fetched.messages, state.lastUid),
        hydratedFromUid,
        highestModSeq: fetched.highestModSeq ?? state.highestModSeq ?? status.highestModSeq,
        fullyHydrated,
        syncedAt: this.clock()
      }
      await this.store.putSyncState(state)
      if (!fetched.messages.length || hydratedFromUid >= beforeUid) {
        if (!fullyHydrated) {
          state = { ...state, fullyHydrated: true, syncedAt: this.clock() }
          await this.store.putSyncState(state)
        }
        break
      }
    }
  }

  private async applyFetch(mailboxId: string, fetched: MailboxFetchResult): Promise<void> {
    const messages = fetched.messages.map(message => ({ ...message, mailboxId }))
    await this.putMessages(messages)
    if (fetched.vanishedUids?.length) {
      await this.store.removeMessagesByUid(this.accountId, mailboxId, fetched.vanishedUids)
    }
  }

  private putMessages(messages: RemoteMailMessage[]): void | Promise<void> {
    return this.store.putMessages(this.accountId, uniqueMessages(messages, this.transport.provider === 'gmail'), {
      dedupeByGmailMessageId: this.transport.provider === 'gmail'
    })
  }

  private async idleLoop(): Promise<void> {
    let failures = 0
    while (!this.abort.signal.aborted) {
      let changed = false
      try {
        await this.transport.idle(this.abort.signal, () => {
          changed = true
          this.onEvent?.({ type: 'change', accountId: this.accountId })
        })
        if (this.abort.signal.aborted) break
        if (changed) await this.sync()
        failures = 0
        this.onEvent?.({ type: 'connection', accountId: this.accountId, connected: true })
      } catch (error) {
        if (this.abort.signal.aborted) break
        failures += 1
        this.onEvent?.({
          type: 'connection',
          accountId: this.accountId,
          connected: false,
          error: errorText(error)
        })
        if (failures > this.maxIdleReconnects) break
        const delay = Math.min(this.reconnectMaxMs, this.reconnectBaseMs * 2 ** (failures - 1))
        try {
          await wait(delay, this.abort.signal)
        } catch {
          break
        }
      }
    }
  }
}
