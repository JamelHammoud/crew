import { createRequire } from 'node:module'

export const GMAIL_IMAP_ENDPOINT = Object.freeze({
  host: 'imap.gmail.com',
  port: 993,
  secure: true
})

export const GMAIL_SMTP_ENDPOINT = Object.freeze({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true
})

export interface GmailCredentials {
  user: string
  pass?: string
  accessToken?: string
}

export interface GmailEndpoint {
  host: string
  port: number
  secure: boolean
  startTLS?: boolean
  servername?: string
  rejectUnauthorized?: boolean
}

export interface GmailTransportOptions {
  auth: GmailCredentials
  imap?: Partial<GmailEndpoint>
  smtp?: Partial<GmailEndpoint>
  connectionTimeoutMs?: number
  idleRestartMs?: number
  reconnect?: boolean
  reconnectDelayMs?: number
  reconnectMaxDelayMs?: number
  onChange?: (event: GmailChangeEvent) => void
  onDisconnect?: () => void
  onReconnect?: (attempt: number) => void
  onError?: (event: GmailErrorEvent) => void
}

export interface GmailImapConnectionOptions {
  host: string
  port: number
  secure: boolean
  servername?: string
  doSTARTTLS?: boolean
  auth: GmailCredentials
  tls: {
    minVersion: 'TLSv1.2'
    rejectUnauthorized: boolean
    servername?: string
  }
  logger: false
  logRaw: false
  emitLogs: false
  connectionTimeout: number
  maxIdleTime: number
  clientInfo: {
    name: 'Crew'
  }
}

export interface GmailSmtpConnectionOptions {
  host: string
  port: number
  secure: boolean
  requireTLS: boolean
  ignoreTLS: boolean
  auth: GmailCredentials
  tls: {
    minVersion: 'TLSv1.2'
    rejectUnauthorized: boolean
    servername?: string
  }
  logger: false
  debug: false
  connectionTimeout: number
  greetingTimeout: number
  socketTimeout: number
}

export interface GmailAddress {
  name?: string
  address?: string
}

export interface GmailMailbox {
  path: string
  name: string
  delimiter: string
  parentPath: string
  flags: string[]
  specialUse?: string
  subscribed: boolean
  selectable: boolean
  messages?: number
  unseen?: number
  uidNext?: number
  uidValidity?: string
  highestModseq?: string
}

export interface GmailMessageSummary {
  uid: number
  sequence: number
  gmailMessageId?: string
  gmailThreadId?: string
  messageId?: string
  inReplyTo?: string
  subject: string
  from: GmailAddress[]
  sender: GmailAddress[]
  replyTo: GmailAddress[]
  to: GmailAddress[]
  cc: GmailAddress[]
  bcc: GmailAddress[]
  date?: Date
  internalDate?: Date
  size?: number
  flags: string[]
  labels: string[]
  read: boolean
  starred: boolean
  draft: boolean
  answered: boolean
  hasAttachments: boolean
}

export interface GmailAttachment {
  filename?: string
  contentType: string
  contentDisposition?: string
  contentId?: string
  size: number
  checksum?: string
  content: Buffer
}

export interface GmailMessageBody extends GmailMessageSummary {
  text: string
  html?: string
  textAsHtml?: string
  headers: Array<{ key: string; line: string }>
  references: string[]
  attachments: GmailAttachment[]
}

export interface GmailFetchOptions {
  uids?: number[]
  limit?: number
  search?: GmailSearchQuery | string
}

export interface GmailSearchQuery {
  raw?: string
  from?: string
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  body?: string
  text?: string
  read?: boolean
  starred?: boolean
  draft?: boolean
  answered?: boolean
  before?: Date | string
  since?: Date | string
  sentBefore?: Date | string
  sentSince?: Date | string
  larger?: number
  smaller?: number
  gmailMessageId?: string
  gmailThreadId?: string
  labels?: string[]
  withoutLabels?: string[]
}

export interface GmailOutgoingAttachment {
  filename?: string
  content?: Buffer | string
  path?: string
  contentType?: string
  contentDisposition?: 'attachment' | 'inline'
  cid?: string
  encoding?: string
}

export interface GmailOutgoingMessage {
  from?: string | GmailAddress
  to: string | GmailAddress | Array<string | GmailAddress>
  cc?: string | GmailAddress | Array<string | GmailAddress>
  bcc?: string | GmailAddress | Array<string | GmailAddress>
  replyTo?: string | GmailAddress | Array<string | GmailAddress>
  subject: string
  text?: string
  html?: string
  inReplyTo?: string
  references?: string | string[]
  messageId?: string
  date?: Date
  headers?: Record<string, string | string[]>
  attachments?: GmailOutgoingAttachment[]
}

export interface GmailSendResult {
  messageId: string
  accepted: string[]
  rejected: string[]
  pending: string[]
  response?: string
}

export interface GmailDraftResult {
  mailbox: string
  uid?: number
  uidValidity?: string
}

export interface GmailChangeEvent {
  type: 'exists' | 'expunge' | 'flags'
  mailbox?: string
  data: unknown
}

export interface GmailErrorEvent {
  source: 'imap' | 'smtp' | 'reconnect'
  code: GmailTransportErrorCode
}

export type GmailTransportErrorCode =
  | 'ACCOUNT_VALIDATION_FAILED'
  | 'IMAP_VALIDATION_FAILED'
  | 'SMTP_VALIDATION_FAILED'
  | 'NOT_CONNECTED'
  | 'MAILBOX_NOT_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'IMAP_OPERATION_FAILED'
  | 'SMTP_SEND_FAILED'
  | 'MIME_PARSE_FAILED'
  | 'DRAFT_OPERATION_FAILED'
  | 'RECONNECT_FAILED'

export class GmailTransportError extends Error {
  readonly code: GmailTransportErrorCode

  constructor(code: GmailTransportErrorCode, message: string) {
    super(message)
    this.name = 'GmailTransportError'
    this.code = code
  }
}

interface ImapListStatus {
  messages?: number
  unseen?: number
  uidNext?: number
  uidValidity?: bigint
  highestModseq?: bigint
}

interface ImapListEntry {
  path: string
  name: string
  delimiter: string
  parentPath: string
  flags: Set<string>
  specialUse?: string
  subscribed: boolean
  status?: ImapListStatus
}

interface ImapEnvelope {
  date?: Date
  subject?: string
  messageId?: string
  inReplyTo?: string
  from?: GmailAddress[]
  sender?: GmailAddress[]
  replyTo?: GmailAddress[]
  to?: GmailAddress[]
  cc?: GmailAddress[]
  bcc?: GmailAddress[]
}

interface ImapBodyStructure {
  disposition?: string
  childNodes?: ImapBodyStructure[]
}

interface ImapFetchMessage {
  seq: number
  uid: number
  source?: Buffer
  emailId?: string
  threadId?: string
  labels?: Set<string>
  size?: number
  flags?: Set<string>
  envelope?: ImapEnvelope
  bodyStructure?: ImapBodyStructure
  internalDate?: Date | string
}

interface ImapAppendResult {
  destination: string
  uidValidity?: bigint
  uid?: number
}

interface ImapClient {
  usable: boolean
  authenticated: string | boolean
  capabilities: Map<string, boolean | number>
  mailbox: { path: string } | false
  connect(): Promise<void>
  logout(): Promise<void>
  close(): void
  list(options?: unknown): Promise<ImapListEntry[]>
  getMailboxLock(path: string): Promise<{ release(): void }>
  mailboxOpen(path: string): Promise<unknown>
  mailboxCreate(path: string): Promise<{ path: string; created: boolean; mailboxId?: string }>
  mailboxSubscribe(path: string): Promise<boolean>
  fetchAll(range: string | number[], query: Record<string, boolean>, options?: { uid?: boolean }): Promise<ImapFetchMessage[]>
  fetchOne(range: number, query: Record<string, boolean>, options?: { uid?: boolean }): Promise<ImapFetchMessage | false>
  search(query: Record<string, unknown>, options?: { uid?: boolean }): Promise<number[] | false>
  messageMove(range: number | number[], destination: string, options?: { uid?: boolean }): Promise<unknown>
  messageDelete(range: number | number[], options?: { uid?: boolean }): Promise<boolean>
  messageFlagsAdd(
    range: number | number[],
    flags: string[],
    options?: { uid?: boolean; useLabels?: boolean }
  ): Promise<boolean>
  messageFlagsRemove(
    range: number | number[],
    flags: string[],
    options?: { uid?: boolean; useLabels?: boolean }
  ): Promise<boolean>
  messageFlagsSet(
    range: number | number[],
    flags: string[],
    options?: { uid?: boolean; useLabels?: boolean }
  ): Promise<boolean>
  append(path: string, content: Buffer, flags?: string[], idate?: Date): Promise<ImapAppendResult | false>
  on(event: 'close', listener: () => void): this
  on(event: 'error', listener: (error: Error) => void): this
  on(event: 'exists' | 'expunge' | 'flags', listener: (data: unknown) => void): this
}

interface SmtpSendInfo {
  messageId?: string
  accepted?: unknown[]
  rejected?: unknown[]
  pending?: unknown[]
  response?: string
  message?: Buffer | string
}

interface SmtpClient {
  verify(): Promise<unknown>
  sendMail(message: Record<string, unknown>): Promise<SmtpSendInfo>
  close?(): void
}

interface ParsedAddressList {
  value?: GmailAddress[]
}

interface ParsedAttachment {
  filename?: string
  contentType?: string
  contentDisposition?: string
  contentId?: string
  size?: number
  checksum?: string
  content?: Buffer
}

interface ParsedMessage {
  text?: string
  html?: string | false
  textAsHtml?: string
  messageId?: string
  inReplyTo?: string
  references?: string | string[]
  date?: Date
  subject?: string
  from?: ParsedAddressList
  sender?: ParsedAddressList
  replyTo?: ParsedAddressList
  to?: ParsedAddressList
  cc?: ParsedAddressList
  bcc?: ParsedAddressList
  headerLines?: Array<{ key: string; line: string }>
  attachments?: ParsedAttachment[]
}

export interface GmailTransportDependencies {
  createImap(options: GmailImapConnectionOptions): ImapClient
  createSmtp(options: GmailSmtpConnectionOptions): SmtpClient
  parseMime(source: Buffer): Promise<ParsedMessage>
  composeMime(message: Record<string, unknown>): Promise<Buffer>
}

const require = createRequire(import.meta.url)

function defaultDependencies(): GmailTransportDependencies {
  const imapflow = require('imapflow') as { ImapFlow: new (options: GmailImapConnectionOptions) => ImapClient }
  const nodemailer = require('nodemailer') as {
    createTransport(options: Record<string, unknown>): SmtpClient
  }
  const mailparser = require('mailparser') as {
    simpleParser(source: Buffer): Promise<ParsedMessage>
  }

  return {
    createImap: (options) => new imapflow.ImapFlow(options),
    createSmtp: (options) => nodemailer.createTransport(options),
    parseMime: (source) => mailparser.simpleParser(source),
    composeMime: async (message) => {
      const transport = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
        newline: 'unix'
      })
      const info = await transport.sendMail(message)
      if (Buffer.isBuffer(info.message)) return info.message
      if (typeof info.message === 'string') return Buffer.from(info.message)
      throw new GmailTransportError('DRAFT_OPERATION_FAILED', 'The draft could not be composed.')
    }
  }
}

function endpoint(defaults: Readonly<GmailEndpoint>, value?: Partial<GmailEndpoint>): GmailEndpoint {
  return { ...defaults, ...value }
}

function servernameFor(value: GmailEndpoint): string | undefined {
  if (!value.secure && value.startTLS !== true) return undefined
  return value.servername ?? value.host
}

export function gmailImapConnectionOptions(options: GmailTransportOptions): GmailImapConnectionOptions {
  const value = endpoint(GMAIL_IMAP_ENDPOINT, options.imap)
  const servername = servernameFor(value)
  return {
    host: value.host,
    port: value.port,
    secure: value.secure,
    ...(servername ? { servername } : {}),
    ...(!value.secure ? { doSTARTTLS: value.startTLS === true } : {}),
    auth: { ...options.auth },
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: value.rejectUnauthorized !== false,
      ...(servername ? { servername } : {})
    },
    logger: false,
    logRaw: false,
    emitLogs: false,
    connectionTimeout: options.connectionTimeoutMs ?? 30_000,
    maxIdleTime: options.idleRestartMs ?? 25 * 60_000,
    clientInfo: { name: 'Crew' }
  }
}

export function gmailSmtpConnectionOptions(options: GmailTransportOptions): GmailSmtpConnectionOptions {
  const value = endpoint(GMAIL_SMTP_ENDPOINT, options.smtp)
  const servername = servernameFor(value)
  const startTLS = !value.secure && value.startTLS === true
  const timeout = options.connectionTimeoutMs ?? 30_000
  return {
    host: value.host,
    port: value.port,
    secure: value.secure,
    requireTLS: startTLS,
    ignoreTLS: !value.secure && !startTLS,
    auth: { ...options.auth },
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: value.rejectUnauthorized !== false,
      ...(servername ? { servername } : {})
    },
    logger: false,
    debug: false,
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: Math.max(timeout, 60_000)
  }
}

function addresses(value?: GmailAddress[]): GmailAddress[] {
  return value?.map((entry) => ({
    ...(entry.name ? { name: entry.name } : {}),
    ...(entry.address ? { address: entry.address } : {})
  })) ?? []
}

function hasAttachment(value?: ImapBodyStructure): boolean {
  if (!value) return false
  if (value.disposition?.toLowerCase() === 'attachment') return true
  return value.childNodes?.some(hasAttachment) ?? false
}

function dateValue(value?: Date | string): Date | undefined {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function summaryFrom(message: ImapFetchMessage): GmailMessageSummary {
  const envelope = message.envelope
  const flags = [...(message.flags ?? [])]
  return {
    uid: message.uid,
    sequence: message.seq,
    ...(message.emailId ? { gmailMessageId: message.emailId } : {}),
    ...(message.threadId ? { gmailThreadId: message.threadId } : {}),
    ...(envelope?.messageId ? { messageId: envelope.messageId } : {}),
    ...(envelope?.inReplyTo ? { inReplyTo: envelope.inReplyTo } : {}),
    subject: envelope?.subject ?? '',
    from: addresses(envelope?.from),
    sender: addresses(envelope?.sender),
    replyTo: addresses(envelope?.replyTo),
    to: addresses(envelope?.to),
    cc: addresses(envelope?.cc),
    bcc: addresses(envelope?.bcc),
    ...(dateValue(envelope?.date) ? { date: dateValue(envelope?.date) } : {}),
    ...(dateValue(message.internalDate) ? { internalDate: dateValue(message.internalDate) } : {}),
    ...(message.size !== undefined ? { size: message.size } : {}),
    flags,
    labels: [...(message.labels ?? [])],
    read: flags.includes('\\Seen'),
    starred: flags.includes('\\Flagged'),
    draft: flags.includes('\\Draft'),
    answered: flags.includes('\\Answered'),
    hasAttachments: hasAttachment(message.bodyStructure)
  }
}

function mailboxFrom(entry: ImapListEntry): GmailMailbox {
  const status = entry.status
  return {
    path: entry.path,
    name: entry.name,
    delimiter: entry.delimiter,
    parentPath: entry.parentPath,
    flags: [...entry.flags],
    ...(entry.specialUse ? { specialUse: entry.specialUse } : {}),
    subscribed: entry.subscribed,
    selectable: !entry.flags.has('\\Noselect'),
    ...(status?.messages !== undefined ? { messages: status.messages } : {}),
    ...(status?.unseen !== undefined ? { unseen: status.unseen } : {}),
    ...(status?.uidNext !== undefined ? { uidNext: status.uidNext } : {}),
    ...(status?.uidValidity !== undefined ? { uidValidity: status.uidValidity.toString() } : {}),
    ...(status?.highestModseq !== undefined ? { highestModseq: status.highestModseq.toString() } : {})
  }
}

function searchObject(query: GmailSearchQuery | string): Record<string, unknown> {
  if (typeof query === 'string') return { gmraw: query }
  return {
    ...(query.raw ? { gmraw: query.raw } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.cc ? { cc: query.cc } : {}),
    ...(query.bcc ? { bcc: query.bcc } : {}),
    ...(query.subject ? { subject: query.subject } : {}),
    ...(query.body ? { body: query.body } : {}),
    ...(query.text ? { text: query.text } : {}),
    ...(query.read !== undefined ? { seen: query.read } : {}),
    ...(query.starred !== undefined ? { flagged: query.starred } : {}),
    ...(query.draft !== undefined ? { draft: query.draft } : {}),
    ...(query.answered !== undefined ? { answered: query.answered } : {}),
    ...(query.before ? { before: query.before } : {}),
    ...(query.since ? { since: query.since } : {}),
    ...(query.sentBefore ? { sentBefore: query.sentBefore } : {}),
    ...(query.sentSince ? { sentSince: query.sentSince } : {}),
    ...(query.larger !== undefined ? { larger: query.larger } : {}),
    ...(query.smaller !== undefined ? { smaller: query.smaller } : {}),
    ...(query.gmailMessageId ? { emailId: query.gmailMessageId } : {}),
    ...(query.gmailThreadId ? { threadId: query.gmailThreadId } : {}),
    ...(query.labels?.length || query.withoutLabels?.length
      ? { labels: { ...(query.labels?.length ? { has: query.labels } : {}), ...(query.withoutLabels?.length ? { not: query.withoutLabels } : {}) } }
      : {})
  }
}

function outgoingAddress(value?: string | GmailAddress | Array<string | GmailAddress>): unknown {
  if (!value) return undefined
  const map = (entry: string | GmailAddress): string | GmailAddress =>
    typeof entry === 'string' ? entry : { ...(entry.name ? { name: entry.name } : {}), ...(entry.address ? { address: entry.address } : {}) }
  return Array.isArray(value) ? value.map(map) : map(value)
}

function outgoingMessage(user: string, message: GmailOutgoingMessage): Record<string, unknown> {
  return {
    from: outgoingAddress(message.from) ?? user,
    to: outgoingAddress(message.to),
    ...(message.cc ? { cc: outgoingAddress(message.cc) } : {}),
    ...(message.bcc ? { bcc: outgoingAddress(message.bcc) } : {}),
    ...(message.replyTo ? { replyTo: outgoingAddress(message.replyTo) } : {}),
    subject: message.subject,
    ...(message.text !== undefined ? { text: message.text } : {}),
    ...(message.html !== undefined ? { html: message.html } : {}),
    ...(message.inReplyTo ? { inReplyTo: message.inReplyTo } : {}),
    ...(message.references ? { references: message.references } : {}),
    ...(message.messageId ? { messageId: message.messageId } : {}),
    ...(message.date ? { date: message.date } : {}),
    ...(message.headers ? { headers: message.headers } : {}),
    ...(message.attachments?.length ? { attachments: message.attachments.map((entry) => ({ ...entry })) } : {})
  }
}

function recipient(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'address' in value && typeof value.address === 'string') return value.address
  return String(value)
}

const specialUseFallbacks: Record<string, string[]> = {
  '\\All': ['[gmail]/all mail', 'all mail', 'archive'],
  '\\Archive': ['archive', '[gmail]/all mail', 'all mail'],
  '\\Drafts': ['[gmail]/drafts', 'drafts'],
  '\\Flagged': ['[gmail]/starred', 'starred'],
  '\\Junk': ['[gmail]/spam', 'spam', 'junk'],
  '\\Sent': ['[gmail]/sent mail', 'sent mail', 'sent'],
  '\\Trash': ['[gmail]/trash', 'trash', 'deleted items']
}

export class GmailTransport {
  private imap: ImapClient
  private readonly smtp: SmtpClient
  private mailboxes: GmailMailbox[] = []
  private accepted = false
  private closing = false
  private reconnecting?: Promise<void>
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private reconnectAttempt = 0
  private watchedMailbox?: string

  constructor(
    private readonly options: GmailTransportOptions,
    private readonly dependencies: GmailTransportDependencies = defaultDependencies()
  ) {
    this.imap = this.dependencies.createImap(gmailImapConnectionOptions(options))
    this.smtp = this.dependencies.createSmtp(gmailSmtpConnectionOptions(options))
    this.bindImap(this.imap)
  }

  get connected(): boolean {
    return this.accepted && this.imap.usable
  }

  async connect(): Promise<void> {
    if (this.connected) return
    this.closing = false
    const imapValidation = (async () => {
      await this.imap.connect()
      return await this.loadMailboxes(this.imap)
    })()
    const smtpValidation = this.smtp.verify()
    const [imapResult, smtpResult] = await Promise.allSettled([imapValidation, smtpValidation])
    if (imapResult.status === 'rejected' || smtpResult.status === 'rejected') {
      if (this.imap.usable || this.imap.authenticated) {
        await this.imap.logout().catch(() => undefined)
      } else {
        this.imap.close()
      }
      const code =
        imapResult.status === 'rejected' && smtpResult.status === 'rejected'
          ? 'ACCOUNT_VALIDATION_FAILED'
          : imapResult.status === 'rejected'
            ? 'IMAP_VALIDATION_FAILED'
            : 'SMTP_VALIDATION_FAILED'
      throw new GmailTransportError(code, 'The Gmail account could not be verified.')
    }
    this.mailboxes = imapResult.value
    this.accepted = true
    this.reconnectAttempt = 0
  }

  async close(): Promise<void> {
    this.closing = true
    this.accepted = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.smtp.close?.()
    if (this.imap.usable || this.imap.authenticated) {
      await this.imap.logout().catch(() => this.imap.close())
    } else {
      this.imap.close()
    }
  }

  async listMailboxes(refresh = true): Promise<GmailMailbox[]> {
    await this.ready()
    if (refresh) this.mailboxes = await this.loadMailboxes(this.imap)
    return this.mailboxes.map((mailbox) => ({ ...mailbox, flags: [...mailbox.flags] }))
  }

  async createMailbox(path: string, subscribe = true): Promise<{ path: string; created: boolean; mailboxId?: string }> {
    await this.ready()
    try {
      const result = await this.imap.mailboxCreate(path)
      if (subscribe) await this.imap.mailboxSubscribe(result.path)
      this.mailboxes = await this.loadMailboxes(this.imap)
      return result
    } catch {
      throw new GmailTransportError('IMAP_OPERATION_FAILED', 'The mailbox could not be created.')
    }
  }

  async search(mailbox: string, query: GmailSearchQuery | string): Promise<number[]> {
    return await this.withMailbox(mailbox, async (client) => {
      try {
        return (await client.search(searchObject(query), { uid: true })) || []
      } catch {
        throw new GmailTransportError('IMAP_OPERATION_FAILED', 'The Gmail search could not be completed.')
      }
    })
  }

  async fetchSummaries(mailbox: string, options: GmailFetchOptions = {}): Promise<GmailMessageSummary[]> {
    return await this.withMailbox(mailbox, async (client) => {
      let range: string | number[]
      if (options.uids) {
        if (options.uids.length === 0) return []
        range = options.uids
      } else if (options.search) {
        const matches = await client.search(searchObject(options.search), { uid: true })
        if (!matches || matches.length === 0) return []
        range = options.limit ? matches.slice(-options.limit) : matches
      } else {
        const limit = Math.max(1, Math.floor(options.limit ?? 50))
        range = `*:-${limit}`
      }
      try {
        const messages = await client.fetchAll(
          range,
          {
            uid: true,
            flags: true,
            envelope: true,
            bodyStructure: true,
            internalDate: true,
            size: true,
            threadId: true,
            labels: true
          },
          { uid: Array.isArray(range) }
        )
        return messages.map(summaryFrom).sort((left, right) => {
          const leftTime = left.date?.getTime() ?? left.internalDate?.getTime() ?? 0
          const rightTime = right.date?.getTime() ?? right.internalDate?.getTime() ?? 0
          return rightTime - leftTime || right.uid - left.uid
        })
      } catch {
        throw new GmailTransportError('IMAP_OPERATION_FAILED', 'Messages could not be fetched.')
      }
    })
  }

  async fetchBody(mailbox: string, uid: number): Promise<GmailMessageBody> {
    return await this.withMailbox(mailbox, async (client) => {
      let message: ImapFetchMessage | false
      try {
        message = await client.fetchOne(
          uid,
          {
            uid: true,
            flags: true,
            envelope: true,
            bodyStructure: true,
            internalDate: true,
            size: true,
            threadId: true,
            labels: true,
            source: true
          },
          { uid: true }
        )
      } catch {
        throw new GmailTransportError('IMAP_OPERATION_FAILED', 'The message could not be fetched.')
      }
      if (!message || !message.source) {
        throw new GmailTransportError('MESSAGE_NOT_FOUND', 'The message was not found.')
      }
      let parsed: ParsedMessage
      try {
        parsed = await this.dependencies.parseMime(message.source)
      } catch {
        throw new GmailTransportError('MIME_PARSE_FAILED', 'The message body could not be read.')
      }
      const parsedAttachments = parsed.attachments ?? []
      return {
        ...summaryFrom(message),
        text: parsed.text ?? '',
        ...(typeof parsed.html === 'string' ? { html: parsed.html } : {}),
        ...(parsed.textAsHtml ? { textAsHtml: parsed.textAsHtml } : {}),
        headers: parsed.headerLines?.map((entry) => ({ key: entry.key, line: entry.line })) ?? [],
        references: Array.isArray(parsed.references)
          ? [...parsed.references]
          : parsed.references
            ? [parsed.references]
            : [],
        attachments: parsedAttachments.map((entry) => ({
          ...(entry.filename ? { filename: entry.filename } : {}),
          contentType: entry.contentType ?? 'application/octet-stream',
          ...(entry.contentDisposition ? { contentDisposition: entry.contentDisposition } : {}),
          ...(entry.contentId ? { contentId: entry.contentId } : {}),
          size: entry.size ?? entry.content?.length ?? 0,
          ...(entry.checksum ? { checksum: entry.checksum } : {}),
          content: entry.content ? Buffer.from(entry.content) : Buffer.alloc(0)
        }))
      }
    })
  }

  async archive(mailbox: string, uids: number | number[]): Promise<void> {
    await this.removeLabels(mailbox, uids, ['\\Inbox'])
  }

  async trash(mailbox: string, uids: number | number[]): Promise<void> {
    await this.moveToSpecialUse(mailbox, uids, '\\Trash')
  }

  async spam(mailbox: string, uids: number | number[]): Promise<void> {
    await this.moveToSpecialUse(mailbox, uids, '\\Junk')
  }

  async setRead(mailbox: string, uids: number | number[], read: boolean): Promise<void> {
    await this.changeFlags(mailbox, uids, ['\\Seen'], read)
  }

  async setStarred(mailbox: string, uids: number | number[], starred: boolean): Promise<void> {
    await this.changeFlags(mailbox, uids, ['\\Flagged'], starred)
  }

  async addLabels(mailbox: string, uids: number | number[], labels: string[]): Promise<void> {
    await this.changeLabels(mailbox, uids, labels, 'add')
  }

  async removeLabels(mailbox: string, uids: number | number[], labels: string[]): Promise<void> {
    await this.changeLabels(mailbox, uids, labels, 'remove')
  }

  async setLabels(mailbox: string, uids: number | number[], labels: string[]): Promise<void> {
    await this.changeLabels(mailbox, uids, labels, 'set')
  }

  async send(message: GmailOutgoingMessage): Promise<GmailSendResult> {
    await this.ready()
    try {
      const info = await this.smtp.sendMail(outgoingMessage(this.options.auth.user, message))
      return {
        messageId: info.messageId ?? '',
        accepted: (info.accepted ?? []).map(recipient),
        rejected: (info.rejected ?? []).map(recipient),
        pending: (info.pending ?? []).map(recipient),
        ...(info.response ? { response: info.response } : {})
      }
    } catch {
      this.options.onError?.({ source: 'smtp', code: 'SMTP_SEND_FAILED' })
      throw new GmailTransportError('SMTP_SEND_FAILED', 'The message could not be sent.')
    }
  }

  async appendDraft(message: GmailOutgoingMessage, mailbox?: string): Promise<GmailDraftResult> {
    await this.ready()
    const destination = mailbox ?? this.specialUsePath('\\Drafts')
    let source: Buffer
    try {
      source = await this.dependencies.composeMime(outgoingMessage(this.options.auth.user, message))
      const result = await this.imap.append(destination, source, ['\\Draft'], message.date)
      if (!result) throw new Error('append failed')
      return {
        mailbox: result.destination,
        ...(result.uid !== undefined ? { uid: result.uid } : {}),
        ...(result.uidValidity !== undefined ? { uidValidity: result.uidValidity.toString() } : {})
      }
    } catch {
      throw new GmailTransportError('DRAFT_OPERATION_FAILED', 'The draft could not be saved.')
    }
  }

  async replaceDraft(
    uid: number,
    message: GmailOutgoingMessage,
    mailbox?: string
  ): Promise<GmailDraftResult> {
    await this.ready()
    const destination = mailbox ?? this.specialUsePath('\\Drafts')
    let source: Buffer
    try {
      source = await this.dependencies.composeMime(outgoingMessage(this.options.auth.user, message))
    } catch {
      throw new GmailTransportError('DRAFT_OPERATION_FAILED', 'The draft could not be composed.')
    }
    return await this.withMailbox(destination, async (client) => {
      try {
        const result = await client.append(destination, source, ['\\Draft'], message.date)
        if (!result) throw new Error('append failed')
        await client.messageDelete(uid, { uid: true })
        return {
          mailbox: result.destination,
          ...(result.uid !== undefined ? { uid: result.uid } : {}),
          ...(result.uidValidity !== undefined ? { uidValidity: result.uidValidity.toString() } : {})
        }
      } catch {
        throw new GmailTransportError('DRAFT_OPERATION_FAILED', 'The draft could not be replaced.')
      }
    })
  }

  async watch(mailbox = 'INBOX'): Promise<void> {
    await this.ready()
    try {
      await this.imap.mailboxOpen(mailbox)
      this.watchedMailbox = mailbox
    } catch {
      throw new GmailTransportError('IMAP_OPERATION_FAILED', 'The mailbox could not be watched.')
    }
  }

  private bindImap(client: ImapClient): void {
    client.on('exists', (data) => this.change('exists', data, client))
    client.on('expunge', (data) => this.change('expunge', data, client))
    client.on('flags', (data) => this.change('flags', data, client))
    client.on('error', () => this.options.onError?.({ source: 'imap', code: 'IMAP_OPERATION_FAILED' }))
    client.on('close', () => {
      if (!this.accepted || this.closing || client !== this.imap) return
      this.options.onDisconnect?.()
      if (this.options.reconnect !== false) void this.reconnect()
    })
  }

  private change(type: GmailChangeEvent['type'], data: unknown, client: ImapClient): void {
    if (client !== this.imap) return
    this.options.onChange?.({ type, ...(client.mailbox ? { mailbox: client.mailbox.path } : {}), data })
  }

  private async reconnect(): Promise<void> {
    if (this.reconnecting) return await this.reconnecting
    this.reconnecting = new Promise<void>((resolve, reject) => {
      this.reconnectAttempt += 1
      const base = Math.max(0, this.options.reconnectDelayMs ?? 1_000)
      const maximum = Math.max(base, this.options.reconnectMaxDelayMs ?? 30_000)
      const delay = Math.min(maximum, base * 2 ** Math.max(0, this.reconnectAttempt - 1))
      this.reconnectTimer = setTimeout(() => {
        void this.performReconnect().then(resolve, reject)
      }, delay)
    }).finally(() => {
      this.reconnecting = undefined
    })
    try {
      await this.reconnecting
    } catch {
      if (!this.closing && this.options.reconnect !== false) void this.reconnect()
    }
  }

  private async performReconnect(): Promise<void> {
    if (this.closing || !this.accepted) return
    const client = this.dependencies.createImap(gmailImapConnectionOptions(this.options))
    this.bindImap(client)
    try {
      await client.connect()
      this.mailboxes = await this.loadMailboxes(client)
      if (this.watchedMailbox) await client.mailboxOpen(this.watchedMailbox)
      this.imap = client
      const attempt = this.reconnectAttempt
      this.reconnectAttempt = 0
      this.options.onReconnect?.(attempt)
    } catch {
      client.close()
      this.options.onError?.({ source: 'reconnect', code: 'RECONNECT_FAILED' })
      throw new GmailTransportError('RECONNECT_FAILED', 'The Gmail connection could not be restored.')
    }
  }

  private async ready(): Promise<void> {
    if (this.reconnecting) await this.reconnecting
    if (!this.connected) throw new GmailTransportError('NOT_CONNECTED', 'The Gmail account is not connected.')
  }

  private async loadMailboxes(client: ImapClient): Promise<GmailMailbox[]> {
    const entries = await client.list({
      statusQuery: {
        messages: true,
        unseen: true,
        uidNext: true,
        uidValidity: true,
        highestModseq: true
      },
      specialUseHints: {
        sent: '[Gmail]/Sent Mail',
        trash: '[Gmail]/Trash',
        junk: '[Gmail]/Spam',
        drafts: '[Gmail]/Drafts',
        archive: '[Gmail]/All Mail'
      }
    })
    return entries.map(mailboxFrom)
  }

  private specialUsePath(specialUse: string): string {
    const exact = this.mailboxes.find((entry) => entry.specialUse?.toLowerCase() === specialUse.toLowerCase())
    if (exact) return exact.path
    const names = specialUseFallbacks[specialUse] ?? []
    const fallback = this.mailboxes.find((entry) => names.includes(entry.path.toLowerCase()))
    if (fallback) return fallback.path
    throw new GmailTransportError('MAILBOX_NOT_FOUND', 'The required Gmail mailbox was not found.')
  }

  private async withMailbox<T>(mailbox: string, operation: (client: ImapClient) => Promise<T>): Promise<T> {
    await this.ready()
    const client = this.imap
    const lock = await client.getMailboxLock(mailbox)
    try {
      return await operation(client)
    } finally {
      lock.release()
      if (this.watchedMailbox && this.watchedMailbox !== mailbox && client === this.imap && client.usable) {
        await client.mailboxOpen(this.watchedMailbox).catch(() => undefined)
      }
    }
  }

  private async moveToSpecialUse(mailbox: string, uids: number | number[], specialUse: string): Promise<void> {
    const destination = this.specialUsePath(specialUse)
    await this.withMailbox(mailbox, async (client) => {
      try {
        await client.messageMove(uids, destination, { uid: true })
      } catch {
        throw new GmailTransportError('IMAP_OPERATION_FAILED', 'The message could not be moved.')
      }
    })
  }

  private async changeFlags(mailbox: string, uids: number | number[], flags: string[], add: boolean): Promise<void> {
    await this.withMailbox(mailbox, async (client) => {
      try {
        if (add) await client.messageFlagsAdd(uids, flags, { uid: true })
        else await client.messageFlagsRemove(uids, flags, { uid: true })
      } catch {
        throw new GmailTransportError('IMAP_OPERATION_FAILED', 'The message flags could not be changed.')
      }
    })
  }

  private async changeLabels(
    mailbox: string,
    uids: number | number[],
    labels: string[],
    action: 'add' | 'remove' | 'set'
  ): Promise<void> {
    await this.withMailbox(mailbox, async (client) => {
      try {
        if (action === 'add') await client.messageFlagsAdd(uids, labels, { uid: true, useLabels: true })
        if (action === 'remove') await client.messageFlagsRemove(uids, labels, { uid: true, useLabels: true })
        if (action === 'set') await client.messageFlagsSet(uids, labels, { uid: true, useLabels: true })
      } catch {
        throw new GmailTransportError('IMAP_OPERATION_FAILED', 'The Gmail labels could not be changed.')
      }
    })
  }
}

export async function createGmailTransport(
  options: GmailTransportOptions,
  dependencies?: GmailTransportDependencies
): Promise<GmailTransport> {
  const transport = new GmailTransport(options, dependencies)
  await transport.connect()
  return transport
}

export async function validateGmailAccount(
  options: GmailTransportOptions,
  dependencies?: GmailTransportDependencies
): Promise<{ mailboxes: GmailMailbox[] }> {
  const transport = new GmailTransport(options, dependencies)
  try {
    await transport.connect()
    return { mailboxes: await transport.listMailboxes(false) }
  } finally {
    await transport.close()
  }
}
