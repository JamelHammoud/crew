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
