import { randomUUID } from 'node:crypto'
import type {
  MailAccount,
  MailAccountInput,
  MailAttachment,
  MailCredentials,
  MailDraft,
  MailLabel,
  MailMessage,
  MailParticipantInput
} from '../../shared/mail'
import { parseMailAccountInput } from '../../shared/mail'
import { MailCredentialStore } from './credentials'
import { MailDatabase } from './database'
import { MailFileStore } from './files'
import {
  GmailTransport,
  type GmailAddress,
  type GmailMessageBody,
  type GmailMessageSummary,
  type GmailOutgoingMessage,
  type GmailTransportOptions
} from './gmail'
import {
  MailScheduler,
  type MailSchedulerEvent,
  type MailSchedulerStore,
  type ScheduledSend,
  type SnoozedMessage
} from './scheduler'
import {
  mailAttachmentUrl,
  serveMailScheme,
  type MailAttachment as SchemeAttachment
} from './scheme'
import {
  MailSynchronizer,
  type MailSyncEvent,
  type MailSyncStore,
  type MailSyncTransport,
  type MailboxFetchRequest,
  type MailboxFetchResult,
  type RemoteMailMessage,
  type RemoteMailbox,
  type RemoteMailboxStatus,
  type MailboxSyncState
} from './sync'

export const MAIL_IPC = {
  listAccounts: 'mail:list-accounts',
  connectAccount: 'mail:connect-account',
  removeAccount: 'mail:remove-account',
  reconnectAccount: 'mail:reconnect-account',
  updateAccount: 'mail:update-account',
  listThreads: 'mail:list-threads',
  getThread: 'mail:get-thread',
  sync: 'mail:sync',
  setThreadState: 'mail:set-thread-state',
  saveDraft: 'mail:save-draft',
  discardDraft: 'mail:discard-draft',
  sendDraft: 'mail:send-draft',
  addAttachment: 'mail:add-attachment',
  saveAttachment: 'mail:save-attachment',
  printThread: 'mail:print-thread',
  snoozeThread: 'mail:snooze-thread'
} as const

export const MAIL_RENDERER_EVENTS = {
  changed: 'mail:changed',
  online: 'mail:online',
  connection: 'mail:connection',
  unread: 'mail:unread',
  notification: 'mail:notification'
} as const

export type MailAccountStatus = 'connected' | 'syncing' | 'offline' | 'error'
export type MailboxId = 'inbox' | 'starred' | 'snoozed' | 'sent' | 'drafts' | 'scheduled' | 'all' | 'spam' | 'trash'

export interface MailAddressView {
  name?: string
  email: string
}

export interface MailLabelView {
  id: string
  name: string
  color?: string
  unread?: number
}

export interface MailAccountView {
  id: string
  email: string
  displayName: string
  status: MailAccountStatus
  unread: number
  signature?: string
  labels: MailLabelView[]
  problem?: string
}

export interface MailAttachmentView {
  id: string
  name: string
  mime: string
  size: number
  url?: string
  data?: string
}

export interface MailThreadSummaryView {
  id: string
  accountId: string
  subject: string
  participants: MailAddressView[]
  preview: string
  date: string
  unread: boolean
  starred: boolean
  important?: boolean
  hasAttachments?: boolean
  messageCount: number
  mailboxIds: MailboxId[]
  labelIds: string[]
}

export interface MailMessageView {
  id: string
  threadId: string
  accountId: string
  from: MailAddressView
  to: MailAddressView[]
  cc: MailAddressView[]
  bcc: MailAddressView[]
  subject: string
  date: string
  text: string
  html?: string
  quotedText?: string
  unread: boolean
  starred: boolean
  attachments: MailAttachmentView[]
}

export interface MailThreadView extends MailThreadSummaryView {
  messages: MailMessageView[]
}

export interface MailThreadQueryView {
  accountId?: string
  mailboxId?: MailboxId
  labelId?: string
  query?: string
}

export interface MailDraftViewInput {
  id: string
  accountId: string
  to: MailAddressView[]
  cc: MailAddressView[]
  bcc: MailAddressView[]
  subject: string
  text: string
  html?: string
  attachments: MailAttachmentView[]
  replyTo?: string
  forwardOf?: string
}

export interface SavedDraftResult {
  id: string
  updatedAt: string
}

export interface MailThreadStatePatch {
  read?: boolean
  starred?: boolean
  mailboxId?: MailboxId
  addLabelId?: string
  removeLabelId?: string
}

export interface MailAttachmentUpload {
  name: string
  mime: string
  bytes: Uint8Array
}

export interface StoredMailAttachment {
  id: string
  accountId: string
  messageId: string | null
  storageKey: string
  filename: string
  mimeType: string
  size: number
}

export interface ScheduledDraftPayload {
  draftId: string
}

export interface MailServiceStore extends MailSyncStore, MailSchedulerStore<ScheduledDraftPayload> {
  listAccounts(): MailAccount[] | Promise<MailAccount[]>
  putAccount(input: MailAccountInput): MailAccount | Promise<MailAccount>
  updateAccount(
    accountId: string,
    patch: { displayName?: string; signature?: string; lastSyncedAt?: number | null }
  ): MailAccount | Promise<MailAccount>
  accountSignature(accountId: string): string | undefined | Promise<string | undefined>
  listLabels(accountId: string): MailLabel[] | Promise<MailLabel[]>
  unreadCount(accountId: string): number | Promise<number>
  listThreads(query: MailThreadQueryView): MailThreadSummaryView[] | Promise<MailThreadSummaryView[]>
  getThread(accountId: string, threadId: string): MailThreadView | null | Promise<MailThreadView | null>
  setThreadState(accountId: string, threadIds: string[], patch: MailThreadStatePatch): void | Promise<void>
  saveDraft(draft: MailDraftViewInput): SavedDraftResult | Promise<SavedDraftResult>
  getDraft(accountId: string, draftId: string): MailDraftViewInput | MailDraft | null | Promise<MailDraftViewInput | MailDraft | null>
  discardDraft(accountId: string, draftId: string): void | Promise<void>
  addDraftAttachment(
    accountId: string,
    draftId: string,
    attachment: StoredMailAttachment
  ): MailAttachmentView | Promise<MailAttachmentView>
  getAttachment(accountId: string, attachmentId: string): StoredMailAttachment | null | Promise<StoredMailAttachment | null>
  getAttachmentByOpaqueId(attachmentId: string): StoredMailAttachment | null | Promise<StoredMailAttachment | null>
  listAttachmentStorageKeys(accountId: string): string[] | Promise<string[]>
  deleteAccountData(accountId: string): void | Promise<void>
  takeNotifications?(accountId: string): MailNotification[] | Promise<MailNotification[]>
}

export interface MailConnection extends MailSyncTransport {
  verify(): void | Promise<void>
  setThreadState(threadIds: string[], patch: MailThreadStatePatch): void | Promise<void>
  sendDraft(draft: MailDraftViewInput | MailDraft, providerRequestId: string): void | Promise<void>
}

export interface MailNotification {
  accountId: string
  threadId: string
  messageId: string
  title: string
  body: string
}

export type MailServiceEvent =
  | { type: 'changed'; accountId?: string }
  | { type: 'online'; online: boolean }
  | { type: 'connection'; accountId: string; status: MailAccountStatus; problem?: string }
  | { type: 'unread'; accountId: string; unread: number }
  | { type: 'notification'; notification: MailNotification }

export interface MailServiceOptions {
  store: MailServiceStore
  credentials: Pick<MailCredentialStore, 'get' | 'set' | 'delete'>
  files: Pick<MailFileStore, 'create' | 'read' | 'delete'>
  connect(account: MailAccount, credentials: MailCredentials): MailConnection | Promise<MailConnection>
  onEvent?: (event: MailServiceEvent) => void
  notify?: (notification: MailNotification) => void | Promise<void>
  clock?: () => number
}

function cleanId(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} cannot be empty`)
  return value.trim()
}

function cleanOptional(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`)
  return value.trim()
}

function cleanAddress(value: MailAddressView): MailAddressView {
  const email = cleanId(value?.email, 'Mail address').toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new TypeError('Mail address is invalid')
  const name = cleanOptional(value.name, 'Mail address name')
  return { email, ...(name ? { name } : {}) }
}

function cleanDraft(value: MailDraftViewInput): MailDraftViewInput {
  if (!value || typeof value !== 'object') throw new TypeError('Mail draft must be an object')
  const accountId = cleanId(value.accountId, 'Mail account id')
  const id = cleanId(value.id, 'Mail draft id')
  const attachments = Array.isArray(value.attachments) ? value.attachments.map(attachment => ({ ...attachment })) : []
  return {
    id,
    accountId,
    to: Array.isArray(value.to) ? value.to.map(cleanAddress) : [],
    cc: Array.isArray(value.cc) ? value.cc.map(cleanAddress) : [],
    bcc: Array.isArray(value.bcc) ? value.bcc.map(cleanAddress) : [],
    subject: typeof value.subject === 'string' ? value.subject : '',
    text: typeof value.text === 'string' ? value.text : '',
    ...(typeof value.html === 'string' ? { html: value.html } : {}),
    attachments,
    ...(cleanOptional(value.replyTo, 'Mail reply id') ? { replyTo: cleanOptional(value.replyTo, 'Mail reply id') } : {}),
    ...(cleanOptional(value.forwardOf, 'Mail forward id') ? { forwardOf: cleanOptional(value.forwardOf, 'Mail forward id') } : {})
  }
}

function participantsFor(draft: MailDraftViewInput): MailParticipantInput[] {
  return [
    ...draft.to.map((address, order) => ({ ...address, role: 'to' as const, order })),
    ...draft.cc.map((address, order) => ({ ...address, role: 'cc' as const, order })),
    ...draft.bcc.map((address, order) => ({ ...address, role: 'bcc' as const, order }))
  ]
}

function labelView(label: MailLabel): MailLabelView {
  return {
    id: label.id,
    name: label.name,
    ...(label.color ? { color: label.color } : {}),
    ...(label.unreadCount ? { unread: label.unreadCount } : {})
  }
}

function problemText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function scheduledTime(value: string): number {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) throw new TypeError('Scheduled send time is invalid')
  return time
}

export class MailService {
  private readonly store: MailServiceStore
  private readonly credentials: Pick<MailCredentialStore, 'get' | 'set' | 'delete'>
  private readonly files: Pick<MailFileStore, 'create' | 'read' | 'delete'>
  private readonly connectTransport: MailServiceOptions['connect']
  private readonly onEvent?: (event: MailServiceEvent) => void
  private readonly notify?: (notification: MailNotification) => void | Promise<void>
  private readonly clock: () => number
  private readonly scheduler: MailScheduler<ScheduledDraftPayload>
  private readonly connections = new Map<string, MailConnection>()
  private readonly syncers = new Map<string, MailSynchronizer>()
  private readonly states = new Map<string, { status: MailAccountStatus; problem?: string }>()
  private readonly mutations = new Map<string, Promise<void>>()
  private started = false
  private stopping = false

  constructor(options: MailServiceOptions) {
    this.store = options.store
    this.credentials = options.credentials
    this.files = options.files
    this.connectTransport = options.connect
    this.onEvent = options.onEvent
    this.notify = options.notify
    this.clock = options.clock ?? Date.now
    this.scheduler = new MailScheduler({
      store: options.store,
      actions: {
        send: item => this.sendScheduled(item),
        restore: item => this.restoreSnooze(item)
      },
      onEvent: event => this.schedulerEvent(event),
      clock: this.clock
    })
  }

  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    this.stopping = false
    await this.scheduler.start()
    const accounts = await this.store.listAccounts()
    await Promise.all(accounts.filter(account => account.syncEnabled).map(account => this.openAtStartup(account)))
    this.emitOnline()
  }

  async stop(): Promise<void> {
    if (!this.started || this.stopping) return
    this.stopping = true
    await this.scheduler.stop()
    await Promise.allSettled([...this.syncers.values()].map(syncer => syncer.stop()))
    await Promise.allSettled([...this.mutations.values()])
    this.connections.clear()
    this.syncers.clear()
    this.states.clear()
    this.started = false
    this.stopping = false
  }

  async listAccounts(): Promise<MailAccountView[]> {
    return Promise.all((await this.store.listAccounts()).map(account => this.accountView(account)))
  }

  async connectAccount(input: { email: string; displayName: string; appPassword: string }): Promise<MailAccountView> {
    const id = randomUUID()
    const accountInput = parseMailAccountInput({
      id,
      provider: 'gmail',
      email: input.email,
      displayName: input.displayName,
      syncEnabled: true
    })
    const password = cleanId(input.appPassword, 'Mail app password')
    const account = await this.store.putAccount(accountInput)
    this.credentials.set(id, { username: account.email, password })
    try {
      await this.open(account, true)
      await this.sync(id)
      return this.accountView(account)
    } catch (error) {
      await this.closeAccount(id)
      await this.removeLocalAccount(id)
      throw error
    }
  }

  removeAccount(accountId: string): Promise<void> {
    const id = cleanId(accountId, 'Mail account id')
    return this.mutate(id, async () => {
      await this.closeAccount(id)
      await this.removeLocalAccount(id)
      this.onEvent?.({ type: 'changed', accountId: id })
      this.emitOnline()
    })
  }

  reconnectAccount(accountId: string, appPassword?: string): Promise<MailAccountView> {
    const id = cleanId(accountId, 'Mail account id')
    return this.mutate(id, async () => {
      const account = (await this.store.listAccounts()).find(one => one.id === id)
      if (!account) throw new Error('Mail account was not found')
      if (appPassword !== undefined) {
        const password = cleanId(appPassword, 'Mail app password')
        this.credentials.set(id, { username: account.email, password })
      }
      await this.closeAccount(id)
      await this.open(account, true)
      void this.syncers.get(id)?.startIdle()
      return this.accountView(account)
    })
  }

  updateAccount(
    accountId: string,
    patch: { displayName?: string; signature?: string }
  ): Promise<MailAccountView> {
    const id = cleanId(accountId, 'Mail account id')
    return this.mutate(id, async () => {
      const cleanPatch = {
        ...(patch.displayName !== undefined ? { displayName: cleanOptional(patch.displayName, 'Display name') } : {}),
        ...(patch.signature !== undefined ? { signature: cleanOptional(patch.signature, 'Signature') } : {})
      }
      const account = await this.store.updateAccount(id, cleanPatch)
      this.onEvent?.({ type: 'changed', accountId: id })
      return this.accountView(account)
    })
  }

  async listThreads(query: MailThreadQueryView = {}): Promise<MailThreadSummaryView[]> {
    const search = query.query?.trim()
    if (search) {
      const syncers = query.accountId
        ? [this.syncers.get(query.accountId)].filter((value): value is MailSynchronizer => Boolean(value))
        : [...this.syncers.values()]
      await Promise.all(syncers.map(syncer => syncer.searchGmail(search).catch(() => [])))
    }
    return this.store.listThreads({ ...query })
  }

  async getThread(accountId: string, threadId: string): Promise<MailThreadView> {
    const account = cleanId(accountId, 'Mail account id')
    const thread = cleanId(threadId, 'Mail thread id')
    const value = await this.store.getThread(account, thread)
    if (!value) throw new Error('Mail thread was not found')
    return value
  }

  async sync(accountId?: string): Promise<{ accounts: MailAccountView[]; threads: MailThreadSummaryView[] }> {
    const selected = accountId ? cleanId(accountId, 'Mail account id') : undefined
    const accounts = await this.store.listAccounts()
    const wanted = selected ? accounts.filter(account => account.id === selected) : accounts.filter(account => account.syncEnabled)
    if (selected && !wanted.length) throw new Error('Mail account was not found')
    await Promise.all(wanted.map(account => this.syncAccount(account)))
    return {
      accounts: await this.listAccounts(),
      threads: await this.listThreads(selected ? { accountId: selected } : {})
    }
  }

  setThreadState(accountId: string, threadIds: string[], patch: MailThreadStatePatch): Promise<void> {
    const id = cleanId(accountId, 'Mail account id')
    const ids = [...new Set(threadIds.map(threadId => cleanId(threadId, 'Mail thread id')))]
    if (!ids.length) return Promise.resolve()
    return this.mutate(id, async () => {
      const connection = await this.connection(id)
      await connection.setThreadState(ids, { ...patch })
      await this.store.setThreadState(id, ids, { ...patch })
      await this.emitAccountCounts(id)
      this.onEvent?.({ type: 'changed', accountId: id })
    })
  }

  saveDraft(draft: MailDraftViewInput): Promise<SavedDraftResult> {
    const clean = cleanDraft(draft)
    participantsFor(clean)
    return this.mutate(clean.accountId, async () => {
      const saved = await this.store.saveDraft(clean)
      this.onEvent?.({ type: 'changed', accountId: clean.accountId })
      return saved
    })
  }

  discardDraft(accountId: string, draftId: string): Promise<void> {
    const account = cleanId(accountId, 'Mail account id')
    const draft = cleanId(draftId, 'Mail draft id')
    return this.mutate(account, async () => {
      await this.store.discardDraft(account, draft)
      this.onEvent?.({ type: 'changed', accountId: account })
    })
  }

  async sendDraft(draft: MailDraftViewInput, sendAt?: string): Promise<void> {
    const clean = cleanDraft(draft)
    await this.saveDraft(clean)
    if (sendAt !== undefined) {
      await this.scheduler.schedule(clean.accountId, { draftId: clean.id }, scheduledTime(sendAt))
      return
    }
    await this.mutate(clean.accountId, async () => {
      const stored = await this.store.getDraft(clean.accountId, clean.id)
      if (!stored) throw new Error('Mail draft was not found')
      await (await this.connection(clean.accountId)).sendDraft(stored, randomUUID())
      await this.store.discardDraft(clean.accountId, clean.id)
      this.onEvent?.({ type: 'changed', accountId: clean.accountId })
    })
  }

  addAttachment(
    accountId: string,
    draftId: string,
    upload: MailAttachmentUpload
  ): Promise<MailAttachmentView> {
    const account = cleanId(accountId, 'Mail account id')
    const draft = cleanId(draftId, 'Mail draft id')
    if (!upload || typeof upload !== 'object') return Promise.reject(new TypeError('Mail attachment must be a file'))
    const name = cleanId(upload.name, 'Mail attachment name')
    const mime = cleanOptional(upload.mime, 'Mail attachment MIME type') || 'application/octet-stream'
    if (!(upload.bytes instanceof Uint8Array)) return Promise.reject(new TypeError('Mail attachment contents must be bytes'))
    return this.mutate(account, async () => {
      const id = randomUUID()
      const storageKey = this.files.create(account, upload.bytes)
      try {
        const attachment = await this.store.addDraftAttachment(account, draft, {
          id,
          accountId: account,
          messageId: null,
          storageKey,
          filename: name,
          mimeType: mime,
          size: upload.bytes.byteLength
        })
        this.onEvent?.({ type: 'changed', accountId: account })
        return attachment
      } catch (error) {
        this.files.delete(account, storageKey)
        throw error
      }
    })
  }

  async attachment(accountId: string, attachmentId: string): Promise<SchemeAttachment | null> {
    const account = cleanId(accountId, 'Mail account id')
    const id = cleanId(attachmentId, 'Mail attachment id')
    const attachment = await this.store.getAttachment(account, id)
    if (!attachment || attachment.accountId !== account) return null
    return {
      bytes: this.files.read(account, attachment.storageKey),
      contentType: attachment.mimeType,
      filename: attachment.filename
    }
  }

  async resolveAttachment(attachmentId: string): Promise<SchemeAttachment | null> {
    const id = cleanId(attachmentId, 'Mail attachment id')
    const attachment = await this.store.getAttachmentByOpaqueId(id)
    if (!attachment) return null
    return {
      bytes: this.files.read(attachment.accountId, attachment.storageKey),
      contentType: attachment.mimeType,
      filename: attachment.filename
    }
  }

  snoozeThread(accountId: string, threadId: string, wakeAt: number): Promise<void> {
    const account = cleanId(accountId, 'Mail account id')
    const thread = cleanId(threadId, 'Mail thread id')
    if (!Number.isFinite(wakeAt)) return Promise.reject(new TypeError('Mail snooze time is invalid'))
    return this.mutate(account, async () => {
      await (await this.connection(account)).setThreadState([thread], { mailboxId: 'all' })
      await this.store.setThreadState(account, [thread], { mailboxId: 'snoozed' })
      await this.scheduler.snooze(account, thread, wakeAt)
      this.onEvent?.({ type: 'changed', accountId: account })
    })
  }

  private async accountView(account: MailAccount): Promise<MailAccountView> {
    const [labels, unread, signature] = await Promise.all([
      this.store.listLabels(account.id),
      this.store.unreadCount(account.id),
      this.store.accountSignature(account.id)
    ])
    const state = this.states.get(account.id)
    const status = state?.status ?? (account.syncEnabled ? 'offline' : 'offline')
    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      status,
      unread,
      ...(signature ? { signature } : {}),
      labels: labels.map(labelView),
      ...(state?.problem ? { problem: state.problem } : {})
    }
  }

  private async openAtStartup(account: MailAccount): Promise<void> {
    try {
      await this.open(account, false)
      await this.syncAccount(account)
      void this.syncers.get(account.id)?.startIdle()
    } catch (error) {
      this.setConnection(account.id, 'error', problemText(error))
    }
  }

  private async open(account: MailAccount, verify: boolean): Promise<MailConnection> {
    const existing = this.connections.get(account.id)
    if (existing) return existing
    const credentials = this.credentials.get(account.id)
    if (!credentials) throw new Error('Mail credentials were not found')
    const connection = await this.connectTransport(account, credentials)
    try {
      if (verify) await connection.verify()
    } catch (error) {
      await connection.close()
      throw error
    }
    const syncer = new MailSynchronizer({
      accountId: account.id,
      transport: connection,
      store: this.store,
      onEvent: event => this.syncEvent(event),
      clock: this.clock
    })
    this.connections.set(account.id, connection)
    this.syncers.set(account.id, syncer)
    this.setConnection(account.id, 'connected')
    return connection
  }

  private async connection(accountId: string): Promise<MailConnection> {
    const existing = this.connections.get(accountId)
    if (existing) return existing
    const account = (await this.store.listAccounts()).find(one => one.id === accountId)
    if (!account) throw new Error('Mail account was not found')
    return this.open(account, true)
  }

  private async syncAccount(account: MailAccount): Promise<void> {
    this.setConnection(account.id, 'syncing')
    try {
      await this.open(account, false)
      await this.syncers.get(account.id)?.sync()
      await this.store.updateAccount(account.id, { lastSyncedAt: this.clock() })
      this.setConnection(account.id, 'connected')
      await this.emitAccountCounts(account.id)
      await this.emitNotifications(account.id)
    } catch (error) {
      this.setConnection(account.id, 'error', problemText(error))
      throw error
    }
  }

  private async closeAccount(accountId: string): Promise<void> {
    const syncer = this.syncers.get(accountId)
    this.syncers.delete(accountId)
    this.connections.delete(accountId)
    if (syncer) await syncer.stop()
    this.states.delete(accountId)
  }

  private async removeLocalAccount(accountId: string): Promise<void> {
    const keys = await this.store.listAttachmentStorageKeys(accountId)
    for (const key of keys) this.files.delete(accountId, key)
    await this.store.deleteAccountData(accountId)
    this.credentials.delete(accountId)
  }

  private mutate<T>(accountId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.mutations.get(accountId) ?? Promise.resolve()
    const next = previous.then(work, work)
    const settled = next.then(
      () => undefined,
      () => undefined
    )
    this.mutations.set(accountId, settled)
    void settled.finally(() => {
      if (this.mutations.get(accountId) === settled) this.mutations.delete(accountId)
    })
    return next
  }

  private setConnection(accountId: string, status: MailAccountStatus, problem?: string): void {
    this.states.set(accountId, { status, ...(problem ? { problem } : {}) })
    this.onEvent?.({ type: 'connection', accountId, status, ...(problem ? { problem } : {}) })
    this.onEvent?.({ type: 'changed', accountId })
    this.emitOnline()
  }

  private emitOnline(): void {
    const online = [...this.states.values()].some(state => state.status === 'connected' || state.status === 'syncing')
    this.onEvent?.({ type: 'online', online })
  }

  private async emitAccountCounts(accountId: string): Promise<void> {
    this.onEvent?.({ type: 'unread', accountId, unread: await this.store.unreadCount(accountId) })
  }

  private async emitNotifications(accountId: string): Promise<void> {
    if (!this.store.takeNotifications) return
    const notifications = await this.store.takeNotifications(accountId)
    for (const notification of notifications) {
      this.onEvent?.({ type: 'notification', notification })
      await this.notify?.(notification)
    }
  }

  private syncEvent(event: MailSyncEvent): void {
    if (event.type === 'connection') {
      this.setConnection(event.accountId, event.connected ? 'connected' : 'offline', event.error)
      return
    }
    if (event.type === 'sync:recent' || event.type === 'sync:mailbox' || event.type === 'sync:complete') {
      this.onEvent?.({ type: 'changed', accountId: event.accountId })
    }
  }

  private schedulerEvent(event: MailSchedulerEvent<ScheduledDraftPayload>): void {
    this.onEvent?.({ type: 'changed', accountId: event.item.accountId })
  }

  private async sendScheduled(item: ScheduledSend<ScheduledDraftPayload>): Promise<void> {
    await this.mutate(item.accountId, async () => {
      const draft = await this.store.getDraft(item.accountId, item.payload.draftId)
      if (!draft) throw new Error('Scheduled draft was not found')
      await (await this.connection(item.accountId)).sendDraft(draft, item.id)
      await this.store.discardDraft(item.accountId, item.payload.draftId)
    })
  }

  private async restoreSnooze(item: SnoozedMessage): Promise<void> {
    await this.mutate(item.accountId, async () => {
      await (await this.connection(item.accountId)).setThreadState([item.messageId], { mailboxId: 'inbox' })
      await this.store.setThreadState(item.accountId, [item.messageId], { mailboxId: 'inbox' })
      await this.emitAccountCounts(item.accountId)
    })
  }
}

export interface MailIpcMain {
  handle(channel: string, listener: (event: unknown, ...args: any[]) => unknown): void
  removeHandler(channel: string): void
}

export interface MailMainOptions extends MailServiceOptions {
  ipcMain: MailIpcMain
  emit(channel: string, ...args: unknown[]): void
  saveAttachment(accountId: string, messageId: string, attachment: StoredMailAttachment, bytes: Uint8Array): void | Promise<void>
  printThread(accountId: string, threadId: string, thread: MailThreadView): void | Promise<void>
}

export interface MailMainRegistration {
  service: MailService
  start(): Promise<void>
  stop(): Promise<void>
}

export function registerMailMain(options: MailMainOptions): MailMainRegistration {
  const service = new MailService({
    ...options,
    onEvent: event => {
      options.onEvent?.(event)
      if (event.type === 'changed') options.emit(MAIL_RENDERER_EVENTS.changed)
      if (event.type === 'online') options.emit(MAIL_RENDERER_EVENTS.online, event.online)
      if (event.type === 'connection') options.emit(MAIL_RENDERER_EVENTS.connection, event)
      if (event.type === 'unread') options.emit(MAIL_RENDERER_EVENTS.unread, event)
      if (event.type === 'notification') options.emit(MAIL_RENDERER_EVENTS.notification, event.notification)
    }
  })
  let registered = false
  const handlers: Record<string, (...args: any[]) => unknown> = {
    [MAIL_IPC.listAccounts]: () => service.listAccounts(),
    [MAIL_IPC.connectAccount]: input => service.connectAccount(input),
    [MAIL_IPC.removeAccount]: accountId => service.removeAccount(accountId),
    [MAIL_IPC.reconnectAccount]: (accountId, appPassword) => service.reconnectAccount(accountId, appPassword),
    [MAIL_IPC.updateAccount]: (accountId, patch) => service.updateAccount(accountId, patch),
    [MAIL_IPC.listThreads]: query => service.listThreads(query),
    [MAIL_IPC.getThread]: (accountId, threadId) => service.getThread(accountId, threadId),
    [MAIL_IPC.sync]: accountId => service.sync(accountId),
    [MAIL_IPC.setThreadState]: (accountId, threadIds, patch) => service.setThreadState(accountId, threadIds, patch),
    [MAIL_IPC.saveDraft]: draft => service.saveDraft(draft),
    [MAIL_IPC.discardDraft]: (accountId, draftId) => service.discardDraft(accountId, draftId),
    [MAIL_IPC.sendDraft]: (draft, sendAt) => service.sendDraft(draft, sendAt),
    [MAIL_IPC.addAttachment]: (accountId, draftId, upload) => service.addAttachment(accountId, draftId, upload),
    [MAIL_IPC.saveAttachment]: async (accountId, messageId, attachmentId) => {
      const attachment = await options.store.getAttachment(accountId, attachmentId)
      if (!attachment || attachment.messageId !== messageId) throw new Error('Mail attachment was not found')
      await options.saveAttachment(accountId, messageId, attachment, options.files.read(accountId, attachment.storageKey))
    },
    [MAIL_IPC.printThread]: async (accountId, threadId) => {
      await options.printThread(accountId, threadId, await service.getThread(accountId, threadId))
    },
    [MAIL_IPC.snoozeThread]: (accountId, threadId, wakeAt) => service.snoozeThread(accountId, threadId, wakeAt)
  }
  return {
    service,
    async start() {
      if (!registered) {
        serveMailScheme(id => service.resolveAttachment(id))
        for (const [channel, handler] of Object.entries(handlers)) {
          options.ipcMain.handle(channel, (_event, ...args) => handler(...args))
        }
        registered = true
      }
      await service.start()
    },
    async stop() {
      await service.stop()
      if (registered) {
        for (const channel of Object.keys(handlers)) options.ipcMain.removeHandler(channel)
        registered = false
      }
    }
  }
}

const CURSOR_SYNC = 'mail:sync:'
const CURSOR_UID = 'mail:uid:'
const CURSOR_BODY = 'mail:body:'
const CURSOR_SIGNATURE = 'mail:signature'
const CURSOR_SCHEDULE = 'mail:schedule:'

function cursorPart(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function parseCursor<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function mailboxType(specialUse?: string): MailLabel['type'] {
  const value = specialUse?.toLowerCase()
  if (value === '\\inbox') return 'inbox'
  if (value === '\\sent') return 'sent'
  if (value === '\\drafts') return 'drafts'
  if (value === '\\trash') return 'trash'
  if (value === '\\junk') return 'spam'
  if (value === '\\all' || value === '\\archive') return 'archive'
  if (value === '\\flagged') return 'starred'
  if (value === '\\important') return 'important'
  return 'user'
}

function attachmentView(attachment: MailAttachment): MailAttachmentView {
  return {
    id: attachment.id,
    name: attachment.filename,
    mime: attachment.mimeType,
    size: attachment.size,
    ...(attachment.storageKey ? { url: mailAttachmentUrl(attachment.id) } : {})
  }
}

function participantAddress(message: MailMessage, role: MailParticipantInput['role']): MailAddressView[] {
  return message.participants
    .filter(participant => participant.role === role)
    .sort((left, right) => left.order - right.order)
    .map(participant => ({
      email: participant.email,
      ...(participant.name ? { name: participant.name } : {})
    }))
}

function mailboxIds(messages: MailMessage[]): MailboxId[] {
  const ids = new Set<MailboxId>()
  for (const message of messages) {
    if (message.isStarred) ids.add('starred')
    if (message.isDraft) ids.add('drafts')
    if (message.isSent) ids.add('sent')
    if (message.isTrashed) ids.add('trash')
    for (const label of message.labels) {
      if (label.type === 'inbox') ids.add('inbox')
      if (label.type === 'spam') ids.add('spam')
      if (label.type === 'archive') ids.add('all')
      if (label.type === 'important') ids.add('all')
    }
  }
  if (!ids.size) ids.add('all')
  return [...ids]
}

export class MailDatabaseServiceStore implements MailServiceStore {
  constructor(
    readonly database: MailDatabase,
    private readonly files: Pick<MailFileStore, 'create'>,
    private readonly clock: () => number = Date.now
  ) {}

  listAccounts(): MailAccount[] {
    return this.database.listAccounts()
  }

  putAccount(input: MailAccountInput): MailAccount {
    return this.database.upsertAccount(input)
  }

  updateAccount(
    accountId: string,
    patch: { displayName?: string; signature?: string; lastSyncedAt?: number | null }
  ): MailAccount {
    const account = this.database.getAccount(accountId)
    if (!account) throw new Error('Mail account was not found')
    let updated = account
    if (patch.displayName !== undefined) {
      updated = this.database.upsertAccount({
        id: account.id,
        provider: account.provider,
        email: account.email,
        displayName: patch.displayName,
        syncEnabled: account.syncEnabled
      })
    }
    if (patch.signature !== undefined) {
      this.database.setCursor(accountId, CURSOR_SIGNATURE, JSON.stringify({ value: patch.signature }))
    }
    if (patch.lastSyncedAt !== undefined) updated = this.database.setAccountLastSyncedAt(accountId, patch.lastSyncedAt)
    return updated
  }

  accountSignature(accountId: string): string | undefined {
    return parseCursor<{ value?: string }>(this.database.getCursor(accountId, CURSOR_SIGNATURE))?.value || undefined
  }

  listLabels(accountId: string): MailLabel[] {
    return this.database.listLabels(accountId)
  }

  unreadCount(accountId: string): number {
    const inbox = this.database.listLabels(accountId).find(label => label.type === 'inbox')
    if (inbox) return inbox.unreadCount
    return this.allMessages(accountId, { unread: true }).length
  }

  listThreads(query: MailThreadQueryView): MailThreadSummaryView[] {
    const accounts = query.accountId
      ? [this.database.getAccount(query.accountId)].filter((value): value is MailAccount => Boolean(value))
      : this.database.listAccounts()
    const queryText = query.query?.trim().toLocaleLowerCase()
    const summaries: MailThreadSummaryView[] = []
    for (const account of accounts) {
      for (const thread of this.database.listThreads(account.id, 200)) {
        const messages = this.allMessages(account.id, { threadId: thread.id })
        const summary = this.threadSummary(thread.id, account.id, thread.subject, thread.snippet, thread.latestAt, messages)
        if (query.mailboxId && !summary.mailboxIds.includes(query.mailboxId)) continue
        if (query.labelId && !summary.labelIds.includes(query.labelId)) continue
        if (queryText) {
          const words = [summary.subject, summary.preview, ...summary.participants.map(one => `${one.name ?? ''} ${one.email}`)]
            .join(' ')
            .toLocaleLowerCase()
          if (!words.includes(queryText)) continue
        }
        summaries.push(summary)
      }
    }
    return summaries.sort((left, right) => Date.parse(right.date) - Date.parse(left.date) || left.id.localeCompare(right.id))
  }

  getThread(accountId: string, threadId: string): MailThreadView | null {
    const thread = this.database.getThread(accountId, threadId)
    if (!thread) return null
    const messages = this.allMessages(accountId, { threadId })
    return {
      ...this.threadSummary(thread.id, accountId, thread.subject, thread.snippet, thread.latestAt, messages),
      messages: messages
        .sort((left, right) => left.receivedAt - right.receivedAt || left.id.localeCompare(right.id))
        .map(message => this.messageView(message, threadId))
    }
  }

  setThreadState(accountId: string, threadIds: string[], patch: MailThreadStatePatch): void {
    for (const threadId of threadIds) {
      for (const message of this.allMessages(accountId, { threadId })) {
        const labels = new Set(message.labels.map(label => label.id))
        if (patch.addLabelId) labels.add(patch.addLabelId)
        if (patch.removeLabelId) labels.delete(patch.removeLabelId)
        this.database.upsertMessage(accountId, {
          ...this.messageInput(message),
          ...(patch.read === undefined ? {} : { isRead: patch.read }),
          ...(patch.starred === undefined ? {} : { isStarred: patch.starred }),
          labelIds: [...labels]
        })
      }
    }
  }

  saveDraft(draft: MailDraftViewInput): SavedDraftResult {
    const saved = this.database.upsertDraft(draft.accountId, {
      id: draft.id,
      replyToMessageId: draft.replyTo ?? null,
      subject: draft.subject,
      bodyText: draft.text,
      bodyHtml: draft.html ?? null,
      recipients: participantsFor(draft),
      attachments: draft.attachments.map(attachment => ({
        id: attachment.id,
        draftId: draft.id,
        filename: attachment.name,
        mimeType: attachment.mime,
        size: attachment.size,
        storageKey: this.findAttachment(draft.accountId, attachment.id)?.storageKey ?? null
      }))
    })
    return { id: saved.id, updatedAt: new Date(saved.updatedAt).toISOString() }
  }

  getDraft(accountId: string, draftId: string): MailDraft | null {
    return this.database.getDraft(accountId, draftId)
  }

  discardDraft(accountId: string, draftId: string): void {
    this.database.deleteDraft(accountId, draftId)
  }

  addDraftAttachment(
    accountId: string,
    draftId: string,
    attachment: StoredMailAttachment
  ): MailAttachmentView {
    return attachmentView(this.database.upsertAttachment(accountId, {
      id: attachment.id,
      draftId,
      messageId: null,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      storageKey: attachment.storageKey
    }))
  }

  getAttachment(accountId: string, attachmentId: string): StoredMailAttachment | null {
    return this.storedAttachment(this.findAttachment(accountId, attachmentId))
  }

  getAttachmentByOpaqueId(attachmentId: string): StoredMailAttachment | null {
    for (const account of this.database.listAccounts()) {
      const found = this.getAttachment(account.id, attachmentId)
      if (found) return found
    }
    return null
  }

  listAttachmentStorageKeys(accountId: string): string[] {
    const keys = new Set<string>()
    for (const message of this.allMessages(accountId)) {
      for (const attachment of message.attachments) if (attachment.storageKey) keys.add(attachment.storageKey)
    }
    for (const draft of this.database.listDrafts(accountId)) {
      for (const attachment of draft.attachments) if (attachment.storageKey) keys.add(attachment.storageKey)
    }
    return [...keys]
  }

  deleteAccountData(accountId: string): void {
    this.database.deleteAccount(accountId)
  }

  putMailboxes(accountId: string, mailboxes: RemoteMailbox[]): void {
    for (const mailbox of mailboxes) {
      this.database.upsertLabel(accountId, {
        id: mailbox.id,
        providerId: mailbox.id,
        name: mailbox.name,
        type: mailboxType(mailbox.role)
      })
    }
  }

  getSyncState(accountId: string, mailboxId: string): MailboxSyncState | null {
    return parseCursor<MailboxSyncState>(this.database.getCursor(accountId, `${CURSOR_SYNC}${cursorPart(mailboxId)}`))
  }

  putSyncState(state: MailboxSyncState): void {
    this.database.setCursor(state.accountId, `${CURSOR_SYNC}${cursorPart(state.mailboxId)}`, JSON.stringify(state))
  }

  resetMailbox(accountId: string, mailboxId: string): void {
    this.database.setCursor(accountId, `${CURSOR_SYNC}${cursorPart(mailboxId)}`, JSON.stringify(null))
  }

  putMessages(accountId: string, messages: RemoteMailMessage[]): void {
    for (const message of messages) {
      const id = message.id ?? message.gmailMessageId ?? `${cursorPart(message.mailboxId)}-${message.uid}`
      for (const labelId of message.labelIds ?? []) {
        if (!this.database.listLabels(accountId).some(label => label.id === labelId)) {
          this.database.upsertLabel(accountId, { id: labelId, providerId: labelId, name: labelId })
        }
      }
      const attachments = message.attachments?.map(attachment => {
        const existing = this.findAttachment(accountId, attachment.id)
        const storageKey = existing?.storageKey ?? (attachment.content ? this.files.create(accountId, attachment.content) : null)
        return {
          id: attachment.id,
          messageId: id,
          filename: attachment.filename,
          mimeType: attachment.contentType,
          size: attachment.size,
          contentId: attachment.contentId ?? null,
          inline: attachment.inline ?? false,
          storageKey,
          checksum: attachment.checksum ?? null
        }
      })
      this.database.upsertMessage(accountId, {
        id,
        providerMessageId: message.gmailMessageId ?? message.id ?? id,
        threadId: message.threadId ?? null,
        messageIdHeader: message.messageId ?? null,
        subject: message.subject ?? '',
        snippet: message.preview ?? '',
        bodyText: message.body ?? '',
        bodyHtml: message.bodyHtml ?? null,
        receivedAt: message.internalDate,
        sentAt: message.internalDate,
        isRead: message.flags.includes('\\Seen'),
        isStarred: message.flags.includes('\\Flagged'),
        isDraft: message.flags.includes('\\Draft'),
        isSent: (message.labelIds ?? []).some(label => mailboxType(label) === 'sent'),
        isTrashed: (message.labelIds ?? []).some(label => mailboxType(label) === 'trash'),
        size: message.size ?? 0,
        labelIds: message.labelIds ?? [],
        participants: message.participants,
        attachments
      })
      const ref = { id, mailboxId: message.mailboxId, uid: message.uid }
      this.database.setCursor(accountId, this.uidKey(message.mailboxId, message.uid), JSON.stringify(ref))
      if (message.body !== undefined) {
        this.database.setCursor(accountId, this.bodyKey(message.mailboxId, message.uid), JSON.stringify({ loaded: true }))
      }
    }
  }

  removeMessagesByUid(accountId: string, mailboxId: string, uids: number[]): void {
    for (const uid of uids) {
      const ref = this.remoteRef(accountId, mailboxId, uid)
      if (ref) this.database.deleteMessage(accountId, ref.id)
    }
  }

  getMessageBody(accountId: string, mailboxId: string, uid: number): { body: string } | null {
    if (!this.database.getCursor(accountId, this.bodyKey(mailboxId, uid))) return null
    const ref = this.remoteRef(accountId, mailboxId, uid)
    if (!ref) return null
    const message = this.database.getMessage(accountId, ref.id)
    return message ? { body: message.bodyText } : null
  }

  listScheduledSends(): ScheduledSend<ScheduledDraftPayload>[] {
    return this.database.listDueScheduledSends(Number.MAX_SAFE_INTEGER, 200).map(item => {
      const metadata = parseCursor<Partial<ScheduledSend<ScheduledDraftPayload>>>(
        this.database.getCursor(item.accountId, `${CURSOR_SCHEDULE}${cursorPart(item.id)}`)
      )
      return {
        id: item.id,
        accountId: item.accountId,
        payload: { draftId: item.draftId },
        sendAt: item.sendAt,
        createdAt: item.createdAt,
        attempts: item.attemptCount,
        ...metadata
      }
    })
  }

  putScheduledSend(item: ScheduledSend<ScheduledDraftPayload>): void {
    const existing = this.database.getScheduledSend(item.accountId, item.id)
    if (!existing) this.database.scheduleSend(item.accountId, item.payload.draftId, item.sendAt, item.id)
    else if (item.failedAt !== undefined) {
      this.database.updateScheduledSend(item.accountId, item.id, 'failed', {
        lastError: item.lastError ?? null,
        incrementAttempt: item.attempts > existing.attemptCount
      })
    } else if (item.attempts > existing.attemptCount) {
      this.database.updateScheduledSend(item.accountId, item.id, 'pending', {
        lastError: item.lastError ?? null,
        incrementAttempt: true
      })
    }
    this.database.setCursor(item.accountId, `${CURSOR_SCHEDULE}${cursorPart(item.id)}`, JSON.stringify({
      ...(item.retryAt === undefined ? {} : { retryAt: item.retryAt }),
      ...(item.failedAt === undefined ? {} : { failedAt: item.failedAt }),
      ...(item.lastError === undefined ? {} : { lastError: item.lastError })
    }))
  }

  removeScheduledSend(id: string): void {
    const item = this.database.listDueScheduledSends(Number.MAX_SAFE_INTEGER, 200).find(entry => entry.id === id)
    if (item) this.database.updateScheduledSend(item.accountId, item.id, 'sent')
  }

  listSnoozedMessages(): SnoozedMessage[] {
    return this.database.listDueSnoozes(Number.MAX_SAFE_INTEGER, 200).map(item => ({
      id: item.id,
      accountId: item.accountId,
      messageId: item.threadId ?? item.messageId ?? '',
      wakeAt: item.wakeAt,
      createdAt: item.createdAt
    })).filter(item => Boolean(item.messageId))
  }

  putSnoozedMessage(item: SnoozedMessage): void {
    this.database.snoozeThread(item.accountId, item.messageId, item.wakeAt, item.id)
  }

  removeSnoozedMessage(id: string): void {
    const item = this.database.listDueSnoozes(Number.MAX_SAFE_INTEGER, 200).find(entry => entry.id === id)
    if (item) this.database.deleteSnooze(item.accountId, id)
  }

  refsForThreads(accountId: string, threadIds: string[]): Array<{ mailboxId: string; uid: number }> {
    const refs: Array<{ mailboxId: string; uid: number }> = []
    for (const threadId of threadIds) {
      for (const message of this.allMessages(accountId, { threadId })) {
        const ref = this.providerRef(accountId, message.id)
        if (ref) refs.push(ref)
      }
    }
    return refs
  }

  private allMessages(accountId: string, query: { threadId?: string; unread?: boolean } = {}): MailMessage[] {
    const messages: MailMessage[] = []
    let cursor: string | null = null
    do {
      const page = this.database.listMessages(accountId, { ...query, cursor, limit: 200 })
      messages.push(...page.items)
      cursor = page.nextCursor
    } while (cursor)
    return messages
  }

  private threadSummary(
    id: string,
    accountId: string,
    subject: string,
    snippet: string,
    latestAt: number,
    messages: MailMessage[]
  ): MailThreadSummaryView {
    const people = new Map<string, MailAddressView>()
    for (const message of messages) {
      for (const participant of [...participantAddress(message, 'from'), ...participantAddress(message, 'to')]) {
        people.set(participant.email, participant)
      }
    }
    return {
      id,
      accountId,
      subject,
      participants: [...people.values()],
      preview: snippet,
      date: new Date(latestAt).toISOString(),
      unread: messages.some(message => !message.isRead),
      starred: messages.some(message => message.isStarred),
      important: messages.some(message => message.labels.some(label => label.type === 'important')),
      hasAttachments: messages.some(message => message.attachments.length > 0),
      messageCount: messages.length,
      mailboxIds: mailboxIds(messages),
      labelIds: [...new Set(messages.flatMap(message => message.labels.map(label => label.id)))]
    }
  }

  private messageView(message: MailMessage, threadId: string): MailMessageView {
    return {
      id: message.id,
      threadId,
      accountId: message.accountId,
      from: participantAddress(message, 'from')[0] ?? { email: '' },
      to: participantAddress(message, 'to'),
      cc: participantAddress(message, 'cc'),
      bcc: participantAddress(message, 'bcc'),
      subject: message.subject,
      date: new Date(message.sentAt ?? message.receivedAt).toISOString(),
      text: message.bodyText,
      ...(message.bodyHtml ? { html: message.bodyHtml } : {}),
      unread: !message.isRead,
      starred: message.isStarred,
      attachments: message.attachments.map(attachmentView)
    }
  }

  private messageInput(message: MailMessage) {
    return {
      id: message.id,
      providerMessageId: message.providerMessageId,
      threadId: message.threadId,
      messageIdHeader: message.messageIdHeader,
      inReplyTo: message.inReplyTo,
      subject: message.subject,
      snippet: message.snippet,
      bodyText: message.bodyText,
      bodyHtml: message.bodyHtml,
      sentAt: message.sentAt,
      receivedAt: message.receivedAt,
      isRead: message.isRead,
      isStarred: message.isStarred,
      isDraft: message.isDraft,
      isSent: message.isSent,
      isTrashed: message.isTrashed,
      size: message.size,
      participants: message.participants.map(participant => ({
        id: participant.id,
        role: participant.role,
        email: participant.email,
        name: participant.name,
        order: participant.order
      })),
      attachments: message.attachments.map(attachment => ({
        id: attachment.id,
        messageId: message.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        contentId: attachment.contentId,
        inline: attachment.inline,
        storageKey: attachment.storageKey,
        checksum: attachment.checksum
      }))
    }
  }

  private findAttachment(accountId: string, attachmentId: string): MailAttachment | null {
    for (const message of this.allMessages(accountId)) {
      const found = message.attachments.find(attachment => attachment.id === attachmentId)
      if (found) return found
    }
    for (const draft of this.database.listDrafts(accountId)) {
      const found = draft.attachments.find(attachment => attachment.id === attachmentId)
      if (found) return found
    }
    return null
  }

  private storedAttachment(attachment: MailAttachment | null): StoredMailAttachment | null {
    if (!attachment?.storageKey) return null
    return {
      id: attachment.id,
      accountId: attachment.accountId,
      messageId: attachment.messageId,
      storageKey: attachment.storageKey,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size
    }
  }

  private uidKey(mailboxId: string, uid: number): string {
    return `${CURSOR_UID}${cursorPart(mailboxId)}:${uid}`
  }

  private bodyKey(mailboxId: string, uid: number): string {
    return `${CURSOR_BODY}${cursorPart(mailboxId)}:${uid}`
  }

  private remoteRef(accountId: string, mailboxId: string, uid: number): { id: string; mailboxId: string; uid: number } | null {
    return parseCursor(this.database.getCursor(accountId, this.uidKey(mailboxId, uid)))
  }

  private providerRef(accountId: string, messageId: string): { mailboxId: string; uid: number } | null {
    for (const label of this.database.listLabels(accountId)) {
      const state = this.getSyncState(accountId, label.id)
      if (!state) continue
      for (let uid = state.hydratedFromUid; uid <= state.lastUid; uid += 1) {
        const ref = this.remoteRef(accountId, label.id, uid)
        if (ref?.id === messageId) return { mailboxId: ref.mailboxId, uid: ref.uid }
      }
    }
    return null
  }
}

function gmailAddress(address: GmailAddress): { email: string; name?: string } | null {
  if (!address.address) return null
  return { email: address.address, ...(address.name ? { name: address.name } : {}) }
}

function gmailParticipants(summary: GmailMessageSummary): RemoteMailMessage['participants'] {
  const groups: Array<[NonNullable<RemoteMailMessage['participants']>[number]['role'], GmailAddress[]]> = [
    ['from', summary.from],
    ['sender', summary.sender],
    ['reply-to', summary.replyTo],
    ['to', summary.to],
    ['cc', summary.cc],
    ['bcc', summary.bcc]
  ]
  return groups.flatMap(([role, addresses]) =>
    addresses.flatMap(address => {
      const parsed = gmailAddress(address)
      return parsed ? [{ role, ...parsed }] : []
    })
  )
}

function remoteSummary(mailboxId: string, summary: GmailMessageSummary): RemoteMailMessage {
  return {
    id: summary.gmailMessageId,
    mailboxId,
    uid: summary.uid,
    internalDate: (summary.date ?? summary.internalDate ?? new Date(0)).getTime(),
    flags: [...summary.flags],
    subject: summary.subject,
    from: gmailAddress(summary.from[0] ?? {})?.email,
    to: summary.to.flatMap(address => address.address ? [address.address] : []),
    cc: summary.cc.flatMap(address => address.address ? [address.address] : []),
    messageId: summary.messageId,
    gmailMessageId: summary.gmailMessageId,
    threadId: summary.gmailThreadId,
    size: summary.size,
    labelIds: [...new Set([mailboxId, ...summary.labels])],
    participants: gmailParticipants(summary)
  }
}

function remoteBody(mailboxId: string, body: GmailMessageBody): RemoteMailMessage {
  return {
    ...remoteSummary(mailboxId, body),
    body: body.text,
    bodyHtml: body.html,
    attachments: body.attachments.map((attachment, index) => ({
      id: attachment.checksum || `${body.gmailMessageId ?? body.uid}-${index}`,
      filename: attachment.filename ?? 'Attachment',
      contentType: attachment.contentType,
      size: attachment.size,
      ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
      inline: attachment.contentDisposition === 'inline',
      ...(attachment.checksum ? { checksum: attachment.checksum } : {}),
      content: attachment.content
    }))
  }
}

function outgoingAddress(address: MailAddressView): GmailAddress {
  return { address: address.email, ...(address.name ? { name: address.name } : {}) }
}

export interface GmailMailConnectionOptions {
  account: MailAccount
  credentials: MailCredentials
  store: MailDatabaseServiceStore
  files: Pick<MailFileStore, 'read'>
  transport?: Omit<GmailTransportOptions, 'auth' | 'onChange' | 'onDisconnect' | 'reconnect'>
}

export class GmailMailConnection implements MailConnection {
  readonly provider = 'gmail' as const
  private readonly account: MailAccount
  private readonly store: MailDatabaseServiceStore
  private readonly files: Pick<MailFileStore, 'read'>
  private readonly transport: GmailTransport
  private changeListener: (() => void) | null = null
  private disconnectListener: ((error: Error) => void) | null = null

  constructor(options: GmailMailConnectionOptions) {
    this.account = options.account
    this.store = options.store
    this.files = options.files
    const password = options.credentials.password
    const accessToken = options.credentials.accessToken
    if (!password && !accessToken) throw new Error('Gmail credentials were not found')
    this.transport = new GmailTransport({
      ...options.transport,
      auth: {
        user: options.credentials.username ?? options.account.email,
        ...(password ? { pass: password } : {}),
        ...(accessToken ? { accessToken } : {})
      },
      reconnect: false,
      onChange: () => this.changeListener?.(),
      onDisconnect: () => this.disconnectListener?.(new Error('Gmail disconnected'))
    })
  }

  async verify(): Promise<void> {
    if (!this.transport.connected) await this.transport.connect()
  }

  async listMailboxes(): Promise<RemoteMailbox[]> {
    await this.verify()
    return (await this.transport.listMailboxes()).filter(mailbox => mailbox.selectable).map(mailbox => ({
      id: mailbox.path,
      name: mailbox.name,
      role: mailbox.specialUse
    }))
  }

  async mailboxStatus(mailboxId: string): Promise<RemoteMailboxStatus> {
    await this.verify()
    const mailbox = (await this.transport.listMailboxes()).find(entry => entry.path === mailboxId)
    if (!mailbox) throw new Error('Mail mailbox was not found')
    return {
      uidValidity: mailbox.uidValidity ?? '0',
      uidNext: mailbox.uidNext ?? 1
    }
  }

  async fetchMessages(mailboxId: string, request: MailboxFetchRequest): Promise<MailboxFetchResult> {
    await this.verify()
    if (request.changedSince) throw new Error('Gmail transport does not expose changed-since fetches')
    let uids: number[] | undefined
    if (request.afterUid !== undefined) {
      const afterUid = request.afterUid
      const status = await this.mailboxStatus(mailboxId)
      const end = Math.min(status.uidNext - 1, afterUid + request.limit)
      uids = Array.from({ length: Math.max(0, end - afterUid) }, (_, index) => afterUid + index + 1)
    } else if (request.beforeUid !== undefined) {
      const end = Math.max(0, request.beforeUid - 1)
      const start = Math.max(1, end - request.limit + 1)
      uids = Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index)
    }
    const summaries = await this.transport.fetchSummaries(mailboxId, { uids, limit: request.limit })
    return { messages: summaries.map(summary => remoteSummary(mailboxId, summary)) }
  }

  async fetchBody(mailboxId: string, uid: number): Promise<RemoteMailMessage> {
    await this.verify()
    return remoteBody(mailboxId, await this.transport.fetchBody(mailboxId, uid))
  }

  async searchGmail(query: string): Promise<RemoteMailMessage[]> {
    await this.verify()
    const mailboxes = await this.transport.listMailboxes(false)
    const mailbox = mailboxes.find(entry => entry.specialUse?.toLowerCase() === '\\all')
      ?? mailboxes.find(entry => entry.path === 'INBOX')
    if (!mailbox) return []
    const uids = await this.transport.search(mailbox.path, query)
    return (await this.transport.fetchSummaries(mailbox.path, { uids, limit: 200 }))
      .map(summary => remoteSummary(mailbox.path, summary))
  }

  async idle(signal: AbortSignal, changed: () => void): Promise<void> {
    if (signal.aborted) throw abortErrorForService()
    await this.verify()
    if (this.changeListener || this.disconnectListener) throw new Error('Gmail IDLE is already active')
    await this.transport.watch('INBOX')
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        signal.removeEventListener('abort', stop)
        this.changeListener = null
        this.disconnectListener = null
      }
      const stop = () => {
        cleanup()
        resolve()
      }
      this.changeListener = () => {
        changed()
        cleanup()
        resolve()
      }
      this.disconnectListener = error => {
        cleanup()
        reject(error)
      }
      signal.addEventListener('abort', stop, { once: true })
    })
  }

  close(): Promise<void> {
    this.changeListener = null
    this.disconnectListener = null
    return this.transport.close()
  }

  async setThreadState(threadIds: string[], patch: MailThreadStatePatch): Promise<void> {
    await this.verify()
    const refs = this.store.refsForThreads(this.account.id, threadIds)
    for (const ref of refs) {
      if (patch.read !== undefined) await this.transport.setRead(ref.mailboxId, ref.uid, patch.read)
      if (patch.starred !== undefined) await this.transport.setStarred(ref.mailboxId, ref.uid, patch.starred)
      if (patch.addLabelId) await this.transport.addLabels(ref.mailboxId, ref.uid, [patch.addLabelId])
      if (patch.removeLabelId) await this.transport.removeLabels(ref.mailboxId, ref.uid, [patch.removeLabelId])
      if (patch.mailboxId === 'all' || patch.mailboxId === 'snoozed') await this.transport.archive(ref.mailboxId, ref.uid)
      if (patch.mailboxId === 'spam') await this.transport.spam(ref.mailboxId, ref.uid)
      if (patch.mailboxId === 'trash') await this.transport.trash(ref.mailboxId, ref.uid)
      if (patch.mailboxId === 'inbox') await this.transport.addLabels(ref.mailboxId, ref.uid, ['\\Inbox'])
    }
  }

  async sendDraft(draft: MailDraftViewInput | MailDraft, providerRequestId: string): Promise<void> {
    await this.verify()
    const outgoing = this.outgoing(draft, providerRequestId)
    await this.transport.send(outgoing)
  }

  private outgoing(draft: MailDraftViewInput | MailDraft, providerRequestId: string): GmailOutgoingMessage {
    if ('bodyText' in draft) {
      const recipients = (role: MailParticipantInput['role']) => draft.recipients
        .filter(participant => participant.role === role)
        .map(participant => outgoingAddress({ email: participant.email, ...(participant.name ? { name: participant.name } : {}) }))
      return {
        to: recipients('to'),
        cc: recipients('cc'),
        bcc: recipients('bcc'),
        subject: draft.subject,
        text: draft.bodyText,
        ...(draft.bodyHtml ? { html: draft.bodyHtml } : {}),
        ...(draft.replyToMessageId ? { inReplyTo: draft.replyToMessageId } : {}),
        messageId: `<${providerRequestId}@crew.local>`,
        attachments: draft.attachments.flatMap(attachment => attachment.storageKey ? [{
          filename: attachment.filename,
          contentType: attachment.mimeType,
          content: this.files.read(draft.accountId, attachment.storageKey)
        }] : [])
      }
    }
    return {
      to: draft.to.map(outgoingAddress),
      cc: draft.cc.map(outgoingAddress),
      bcc: draft.bcc.map(outgoingAddress),
      subject: draft.subject,
      text: draft.text,
      ...(draft.html ? { html: draft.html } : {}),
      ...(draft.replyTo ? { inReplyTo: draft.replyTo } : {}),
      messageId: `<${providerRequestId}@crew.local>`,
      attachments: draft.attachments.flatMap(attachment => {
        const stored = this.store.getAttachment(draft.accountId, attachment.id)
        return stored ? [{
          filename: stored.filename,
          contentType: stored.mimeType,
          content: this.files.read(draft.accountId, stored.storageKey)
        }] : []
      })
    }
  }
}

function abortErrorForService(): Error {
  const error = new Error('Mail connection stopped')
  error.name = 'AbortError'
  return error
}

export interface CrewMailRuntimeOptions {
  stateDirectory: string
  ipcMain: MailIpcMain
  emit(channel: string, ...args: unknown[]): void
  saveAttachment(accountId: string, messageId: string, attachment: StoredMailAttachment, bytes: Uint8Array): void | Promise<void>
  printThread(accountId: string, threadId: string, thread: MailThreadView): void | Promise<void>
  notify?: (notification: MailNotification) => void | Promise<void>
  gmail?: Omit<GmailTransportOptions, 'auth' | 'onChange' | 'onDisconnect' | 'reconnect'>
  clock?: () => number
}

export interface CrewMailRuntime extends MailMainRegistration {
  database: MailDatabase
  credentials: MailCredentialStore
  files: MailFileStore
  store: MailDatabaseServiceStore
}

export function createCrewMailRuntime(options: CrewMailRuntimeOptions): CrewMailRuntime {
  const clock = options.clock ?? Date.now
  const database = new MailDatabase(options.stateDirectory, clock)
  const credentials = new MailCredentialStore(options.stateDirectory)
  const files = new MailFileStore(options.stateDirectory)
  const store = new MailDatabaseServiceStore(database, files, clock)
  const registration = registerMailMain({
    store,
    credentials,
    files,
    ipcMain: options.ipcMain,
    emit: options.emit,
    saveAttachment: options.saveAttachment,
    printThread: options.printThread,
    notify: options.notify,
    clock,
    connect: (account, mailCredentials) => new GmailMailConnection({
      account,
      credentials: mailCredentials,
      store,
      files,
      transport: options.gmail
    })
  })
  return {
    ...registration,
    database,
    credentials,
    files,
    store,
    async stop() {
      await registration.stop()
      database.close()
    }
  }
}
