export const MAIL_PROVIDERS = ['gmail', 'outlook', 'imap'] as const
export const MAIL_LABEL_TYPES = ['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive', 'starred', 'important', 'user'] as const
export const MAIL_PARTICIPANT_ROLES = ['from', 'sender', 'reply-to', 'to', 'cc', 'bcc'] as const
export const MAIL_SCHEDULE_STATUSES = ['pending', 'sending', 'sent', 'cancelled', 'failed'] as const

export type MailProvider = (typeof MAIL_PROVIDERS)[number]
export type MailLabelType = (typeof MAIL_LABEL_TYPES)[number]
export type MailParticipantRole = (typeof MAIL_PARTICIPANT_ROLES)[number]
export type MailScheduleStatus = (typeof MAIL_SCHEDULE_STATUSES)[number]

export interface MailAccount {
  id: string
  provider: MailProvider
  email: string
  displayName: string
  signature: string
  syncEnabled: boolean
  lastSyncedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface MailAccountInput {
  id: string
  provider: MailProvider
  email: string
  displayName?: string
  signature?: string
  syncEnabled?: boolean
}

export interface MailLabel {
  accountId: string
  id: string
  providerId: string | null
  name: string
  type: MailLabelType
  color: string | null
  unreadCount: number
  totalCount: number
  createdAt: number
  updatedAt: number
}

export interface MailLabelInput {
  id: string
  providerId?: string | null
  name: string
  type?: MailLabelType
  color?: string | null
  unreadCount?: number
  totalCount?: number
}

export interface MailParticipant {
  id: string
  messageId: string
  role: MailParticipantRole
  email: string
  name: string | null
  order: number
}

export interface MailParticipantInput {
  id?: string
  role: MailParticipantRole
  email: string
  name?: string | null
  order?: number
}

export interface MailAttachment {
  accountId: string
  id: string
  messageId: string | null
  draftId: string | null
  filename: string
  mimeType: string
  size: number
  contentId: string | null
  inline: boolean
  storageKey: string | null
  checksum: string | null
  createdAt: number
}

export interface MailAttachmentInput {
  id: string
  messageId?: string | null
  draftId?: string | null
  filename: string
  mimeType?: string
  size: number
  contentId?: string | null
  inline?: boolean
  storageKey?: string | null
  checksum?: string | null
}

export interface MailMessage {
  accountId: string
  id: string
  providerMessageId: string
  threadId: string | null
  messageIdHeader: string | null
  inReplyTo: string | null
  subject: string
  snippet: string
  bodyText: string
  bodyHtml: string | null
  sentAt: number | null
  receivedAt: number
  isRead: boolean
  isStarred: boolean
  isDraft: boolean
  isSent: boolean
  isTrashed: boolean
  size: number
  labels: MailLabel[]
  participants: MailParticipant[]
  attachments: MailAttachment[]
  createdAt: number
  updatedAt: number
}

export interface MailMessageInput {
  id: string
  providerMessageId: string
  threadId?: string | null
  messageIdHeader?: string | null
  inReplyTo?: string | null
  subject?: string
  snippet?: string
  bodyText?: string
  bodyHtml?: string | null
  sentAt?: number | null
  receivedAt: number
  isRead?: boolean
  isStarred?: boolean
  isDraft?: boolean
  isSent?: boolean
  isTrashed?: boolean
  size?: number
  labelIds?: string[]
  participants?: MailParticipantInput[]
  attachments?: MailAttachmentInput[]
}

export interface MailThread {
  accountId: string
  id: string
  providerThreadId: string | null
  subject: string
  snippet: string
  latestAt: number
  messageCount: number
  unreadCount: number
  createdAt: number
  updatedAt: number
}

export interface MailThreadInput {
  id: string
  providerThreadId?: string | null
  subject?: string
  snippet?: string
  latestAt: number
}

export interface MailDraft {
  accountId: string
  id: string
  providerDraftId: string | null
  replyToMessageId: string | null
  subject: string
  bodyText: string
  bodyHtml: string | null
  recipients: MailParticipant[]
  attachments: MailAttachment[]
  version: number
  createdAt: number
  updatedAt: number
}

export interface MailDraftInput {
  id: string
  providerDraftId?: string | null
  replyToMessageId?: string | null
  subject?: string
  bodyText?: string
  bodyHtml?: string | null
  recipients?: MailParticipantInput[]
  attachments?: MailAttachmentInput[]
  version?: number
}

export interface MailScheduledSend {
  accountId: string
  id: string
  draftId: string
  sendAt: number
  status: MailScheduleStatus
  attemptCount: number
  lastError: string | null
  providerRequestId: string | null
  createdAt: number
  updatedAt: number
}

export interface MailSnooze {
  accountId: string
  id: string
  threadId: string | null
  messageId: string | null
  wakeAt: number
  createdAt: number
}

export interface MailPage<T> {
  items: T[]
  nextCursor: string | null
}

export interface MailPageRequest {
  cursor?: string | null
  limit?: number
}

export interface MailMessageQuery extends MailPageRequest {
  labelId?: string
  threadId?: string
  unread?: boolean
  search?: string
}

export interface MailCredentials {
  username?: string
  password?: string
  accessToken?: string
  refreshToken?: string
  clientId?: string
  expiresAt?: number
}

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
  notification: 'mail:notification',
  notificationOpen: 'mail:notification-open'
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

export interface MailDraftView extends MailDraftViewInput {
  updatedAt: string
  minimized: boolean
  saving: boolean
  saved: boolean
  sending: boolean
  scheduledFor?: string
  problem?: string
}

export interface MailSavedDraftResult {
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

export interface MailNotification {
  accountId: string
  threadId: string
  messageId: string
  title: string
  body: string
}

export interface MailChangedEvent {
  type: 'changed'
  accountId?: string
}

export interface MailOnlineEvent {
  type: 'online'
  online: boolean
}

export interface MailConnectionEvent {
  type: 'connection'
  accountId: string
  status: MailAccountStatus
  problem?: string
}

export interface MailUnreadEvent {
  type: 'unread'
  accountId: string
  unread: number
}

export interface MailNotificationEvent {
  type: 'notification'
  notification: MailNotification
}

export type MailServiceEvent = MailChangedEvent | MailOnlineEvent | MailConnectionEvent | MailUnreadEvent | MailNotificationEvent

export interface MailBridge {
  listAccounts(): Promise<MailAccountView[]>
  connectAccount(input: { email: string; displayName: string; appPassword: string }): Promise<MailAccountView>
  removeAccount(accountId: string): Promise<void>
  reconnectAccount(accountId: string, appPassword?: string): Promise<MailAccountView>
  updateAccount(accountId: string, patch: { displayName?: string; signature?: string }): Promise<MailAccountView>
  listThreads(query: MailThreadQueryView): Promise<MailThreadSummaryView[]>
  getThread(accountId: string, threadId: string): Promise<MailThreadView>
  sync(accountId?: string): Promise<{ accounts: MailAccountView[]; threads: MailThreadSummaryView[] }>
  setThreadState(accountId: string, threadIds: string[], patch: MailThreadStatePatch): Promise<void>
  saveDraft(draft: MailDraftViewInput): Promise<MailSavedDraftResult>
  discardDraft(accountId: string, draftId: string): Promise<void>
  sendDraft(draft: MailDraftViewInput, sendAt?: string): Promise<void>
  addAttachment(accountId: string, draftId: string, file: File): Promise<MailAttachmentView>
  saveAttachment(accountId: string, messageId: string, attachmentId: string): Promise<void>
  printThread(accountId: string, threadId: string): Promise<void>
  snoozeThread(accountId: string, threadId: string, wakeAt: number): Promise<void>
  onChanged(listener: () => void): () => void
  onOnline(listener: (online: boolean) => void): () => void
  onConnection(listener: (event: MailConnectionEvent) => void): () => void
  onUnread(listener: (event: MailUnreadEvent) => void): () => void
  onNotification(listener: (notification: MailNotification) => void): () => void
  onNotificationOpen(listener: (notification: MailNotification) => void): () => void
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${name} must be an object`)
  return value as Record<string, unknown>
}

function text(value: unknown, name: string, required = true): string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`)
  const result = value.trim()
  if (required && !result) throw new TypeError(`${name} cannot be empty`)
  return result
}

function optionalText(value: unknown, name: string): string | undefined {
  return value === undefined ? undefined : text(value, name, false)
}

function optionalNullableText(value: unknown, name: string): string | null | undefined {
  return value === undefined || value === null ? value : text(value, name, false)
}

function optionalStorageKey(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value
  const result = text(value, 'Mail attachment storage key')
  if (!/^[0-9a-f]{32}$/.test(result)) throw new TypeError('Mail attachment storage key is invalid')
  return result
}

function finiteTime(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative number`)
  return value
}

function count(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`)
  return value
}

function optionalBoolean(value: unknown, name: string): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be a boolean`)
  return value
}

function member<T extends string>(value: unknown, values: readonly T[], name: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new TypeError(`${name} is not supported`)
  return value as T
}

export function parseMailAccountInput(value: unknown): MailAccountInput {
  const input = record(value, 'Mail account')
  const email = text(input.email, 'Mail account email').toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new TypeError('Mail account email is invalid')
  return {
    id: text(input.id, 'Mail account id'),
    provider: member(input.provider, MAIL_PROVIDERS, 'Mail account provider'),
    email,
    ...(optionalText(input.displayName, 'Mail account display name') !== undefined
      ? { displayName: optionalText(input.displayName, 'Mail account display name') }
      : {}),
    ...(optionalText(input.signature, 'Mail account signature') !== undefined
      ? { signature: optionalText(input.signature, 'Mail account signature') }
      : {}),
    ...(optionalBoolean(input.syncEnabled, 'Mail account sync enabled') !== undefined
      ? { syncEnabled: optionalBoolean(input.syncEnabled, 'Mail account sync enabled') }
      : {})
  }
}

export function parseMailLabelInput(value: unknown): MailLabelInput {
  const input = record(value, 'Mail label')
  const type = input.type === undefined ? undefined : member(input.type, MAIL_LABEL_TYPES, 'Mail label type')
  return {
    id: text(input.id, 'Mail label id'),
    ...(optionalNullableText(input.providerId, 'Mail label provider id') !== undefined ? { providerId: optionalNullableText(input.providerId, 'Mail label provider id') } : {}),
    name: text(input.name, 'Mail label name'),
    ...(type ? { type } : {}),
    ...(optionalNullableText(input.color, 'Mail label color') !== undefined ? { color: optionalNullableText(input.color, 'Mail label color') } : {}),
    ...(input.unreadCount !== undefined ? { unreadCount: count(input.unreadCount, 'Mail label unread count') } : {}),
    ...(input.totalCount !== undefined ? { totalCount: count(input.totalCount, 'Mail label total count') } : {})
  }
}

export function parseMailParticipantInput(value: unknown): MailParticipantInput {
  const input = record(value, 'Mail participant')
  const email = text(input.email, 'Mail participant email').toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new TypeError('Mail participant email is invalid')
  return {
    ...(input.id === undefined ? {} : { id: text(input.id, 'Mail participant id') }),
    role: member(input.role, MAIL_PARTICIPANT_ROLES, 'Mail participant role'),
    email,
    ...(optionalNullableText(input.name, 'Mail participant name') !== undefined ? { name: optionalNullableText(input.name, 'Mail participant name') } : {}),
    ...(input.order === undefined ? {} : { order: count(input.order, 'Mail participant order') })
  }
}

export function parseMailAttachmentInput(value: unknown): MailAttachmentInput {
  const input = record(value, 'Mail attachment')
  const inline = optionalBoolean(input.inline, 'Mail attachment inline')
  const storageKey = optionalStorageKey(input.storageKey)
  return {
    id: text(input.id, 'Mail attachment id'),
    ...(optionalNullableText(input.messageId, 'Mail attachment message id') !== undefined ? { messageId: optionalNullableText(input.messageId, 'Mail attachment message id') } : {}),
    ...(optionalNullableText(input.draftId, 'Mail attachment draft id') !== undefined ? { draftId: optionalNullableText(input.draftId, 'Mail attachment draft id') } : {}),
    filename: text(input.filename, 'Mail attachment filename'),
    ...(input.mimeType === undefined ? {} : { mimeType: text(input.mimeType, 'Mail attachment MIME type') }),
    size: count(input.size, 'Mail attachment size'),
    ...(optionalNullableText(input.contentId, 'Mail attachment content id') !== undefined ? { contentId: optionalNullableText(input.contentId, 'Mail attachment content id') } : {}),
    ...(inline === undefined ? {} : { inline }),
    ...(storageKey !== undefined ? { storageKey } : {}),
    ...(optionalNullableText(input.checksum, 'Mail attachment checksum') !== undefined ? { checksum: optionalNullableText(input.checksum, 'Mail attachment checksum') } : {})
  }
}

export function parseMailMessageInput(value: unknown): MailMessageInput {
  const input = record(value, 'Mail message')
  const result: MailMessageInput = {
    id: text(input.id, 'Mail message id'),
    providerMessageId: text(input.providerMessageId, 'Mail message provider id'),
    receivedAt: finiteTime(input.receivedAt, 'Mail message received time')
  }
  for (const key of ['threadId', 'messageIdHeader', 'inReplyTo', 'bodyHtml'] as const) {
    const parsed = optionalNullableText(input[key], `Mail message ${key}`)
    if (parsed !== undefined) result[key] = parsed
  }
  for (const key of ['subject', 'snippet', 'bodyText'] as const) {
    const parsed = optionalText(input[key], `Mail message ${key}`)
    if (parsed !== undefined) result[key] = parsed
  }
  if (input.sentAt !== undefined) result.sentAt = input.sentAt === null ? null : finiteTime(input.sentAt, 'Mail message sent time')
  for (const key of ['isRead', 'isStarred', 'isDraft', 'isSent', 'isTrashed'] as const) {
    const parsed = optionalBoolean(input[key], `Mail message ${key}`)
    if (parsed !== undefined) result[key] = parsed
  }
  if (input.size !== undefined) result.size = count(input.size, 'Mail message size')
  if (input.labelIds !== undefined) {
    if (!Array.isArray(input.labelIds)) throw new TypeError('Mail message labels must be an array')
    result.labelIds = [...new Set(input.labelIds.map((item, index) => text(item, `Mail message label ${index}`)))]
  }
  if (input.participants !== undefined) {
    if (!Array.isArray(input.participants)) throw new TypeError('Mail message participants must be an array')
    result.participants = input.participants.map(parseMailParticipantInput)
  }
  if (input.attachments !== undefined) {
    if (!Array.isArray(input.attachments)) throw new TypeError('Mail message attachments must be an array')
    result.attachments = input.attachments.map(parseMailAttachmentInput)
  }
  return result
}

export function parseMailThreadInput(value: unknown): MailThreadInput {
  const input = record(value, 'Mail thread')
  return {
    id: text(input.id, 'Mail thread id'),
    ...(optionalNullableText(input.providerThreadId, 'Mail thread provider id') !== undefined ? { providerThreadId: optionalNullableText(input.providerThreadId, 'Mail thread provider id') } : {}),
    ...(optionalText(input.subject, 'Mail thread subject') !== undefined ? { subject: optionalText(input.subject, 'Mail thread subject') } : {}),
    ...(optionalText(input.snippet, 'Mail thread snippet') !== undefined ? { snippet: optionalText(input.snippet, 'Mail thread snippet') } : {}),
    latestAt: finiteTime(input.latestAt, 'Mail thread latest time')
  }
}

export function parseMailDraftInput(value: unknown): MailDraftInput {
  const input = record(value, 'Mail draft')
  const result: MailDraftInput = { id: text(input.id, 'Mail draft id') }
  for (const key of ['providerDraftId', 'replyToMessageId', 'bodyHtml'] as const) {
    const parsed = optionalNullableText(input[key], `Mail draft ${key}`)
    if (parsed !== undefined) result[key] = parsed
  }
  for (const key of ['subject', 'bodyText'] as const) {
    const parsed = optionalText(input[key], `Mail draft ${key}`)
    if (parsed !== undefined) result[key] = parsed
  }
  if (input.version !== undefined) result.version = count(input.version, 'Mail draft version')
  if (input.recipients !== undefined) {
    if (!Array.isArray(input.recipients)) throw new TypeError('Mail draft recipients must be an array')
    result.recipients = input.recipients.map(parseMailParticipantInput)
  }
  if (input.attachments !== undefined) {
    if (!Array.isArray(input.attachments)) throw new TypeError('Mail draft attachments must be an array')
    result.attachments = input.attachments.map(parseMailAttachmentInput)
  }
  return result
}

export function parseMailCredentials(value: unknown): MailCredentials {
  const input = record(value, 'Mail credentials')
  const result: MailCredentials = {}
  for (const key of ['username', 'password', 'accessToken', 'refreshToken', 'clientId'] as const) {
    const parsed = optionalText(input[key], `Mail credentials ${key}`)
    if (parsed !== undefined) result[key] = parsed
  }
  if (input.expiresAt !== undefined) result.expiresAt = finiteTime(input.expiresAt, 'Mail credentials expiry')
  if (!Object.keys(result).length) throw new TypeError('Mail credentials cannot be empty')
  return result
}

export function mailPageLimit(value: unknown): number {
  if (value === undefined) return 50
  const parsed = count(value, 'Mail page limit')
  if (parsed < 1 || parsed > 200) throw new TypeError('Mail page limit must be between 1 and 200')
  return parsed
}
