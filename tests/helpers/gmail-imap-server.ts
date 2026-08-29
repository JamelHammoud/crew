import { createServer, type Server, type Socket } from 'node:net'
import { randomUUID } from 'node:crypto'

export type GmailAttachment = {
  filename: string
  content: string | Buffer
  contentType?: string
  disposition?: 'attachment' | 'inline'
  contentId?: string
}

export type GmailMessageInput = {
  from: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  text?: string
  html?: string
  date?: Date
  messageId?: string
  inReplyTo?: string
  references?: string[]
  labels?: string[]
  flags?: string[]
  threadId?: string
  attachments?: GmailAttachment[]
  headers?: Record<string, string>
}

export type GmailAccountInput = {
  id?: string
  email: string
  password?: string
  accessToken?: string
  name?: string
  messages?: GmailMessageInput[]
}

export type GmailStoredMessage = {
  uid: number
  gmailId: string
  threadId: string
  raw: Buffer
  input: GmailMessageInput
  labels: Set<string>
  flags: Set<string>
  internalDate: Date
  modseq: number
}

export type CapturedSmtpMessage = {
  accountId: string | null
  envelope: { from: string; to: string[] }
  raw: Buffer
}

type Account = {
  id: string
  email: string
  password: string
  accessToken?: string
  name?: string
  messages: GmailStoredMessage[]
  nextUid: number
  nextGmailId: bigint
  nextThreadId: bigint
  modseq: number
}

type ImapSession = {
  socket: Socket
  buffer: Buffer
  account: Account | null
  selected: string | null
  idleTag: string | null
  literal: { line: string; length: number; plus: boolean } | null
  authMechanism: string | null
  authTag: string | null
  closed: boolean
}

type SmtpSession = {
  socket: Socket
  buffer: Buffer
  account: Account | null
  from: string
  recipients: string[]
  data: string[] | null
  authUser: string | null
}

const CRLF = '\r\n'
const SYSTEM_LABELS = ['INBOX', '[Gmail]/All Mail', '[Gmail]/Drafts', '[Gmail]/Sent Mail', '[Gmail]/Spam', '[Gmail]/Trash', '[Gmail]/Starred']

const quoted = (value: string): string => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
const normalizeLabel = (label: string): string => {
  const clean = label.replace(/^"|"$/g, '')
  if (clean.toUpperCase() === 'INBOX') return 'INBOX'
  const system = SYSTEM_LABELS.find(one => one.toLowerCase() === clean.toLowerCase())
  return system ?? clean
}
const addressList = (value?: string | string[]): string[] => (value ? (Array.isArray(value) ? value : [value]) : [])
const escapeHeader = (value: string): string => value.replace(/[\r\n]+/g, ' ')

function mime(input: GmailMessageInput): Buffer {
  const boundary = `crew-${randomUUID()}`
  const alternatives = input.html != null && input.text != null
  const attachments = input.attachments ?? []
  const mixed = attachments.length > 0
  const headers = [
    `From: ${escapeHeader(input.from)}`,
    `To: ${addressList(input.to).map(escapeHeader).join(', ')}`,
    ...(addressList(input.cc).length ? [`Cc: ${addressList(input.cc).map(escapeHeader).join(', ')}`] : []),
    `Subject: ${escapeHeader(input.subject)}`,
    `Date: ${(input.date ?? new Date()).toUTCString()}`,
    `Message-ID: ${input.messageId ?? `<${randomUUID()}@crew.test>`}`,
    ...(input.inReplyTo ? [`In-Reply-To: ${escapeHeader(input.inReplyTo)}`] : []),
    ...(input.references?.length ? [`References: ${input.references.map(escapeHeader).join(' ')}`] : []),
    'MIME-Version: 1.0',
    ...Object.entries(input.headers ?? {}).map(([key, value]) => `${escapeHeader(key)}: ${escapeHeader(value)}`)
  ]
  const bodyParts: string[] = []
  const text = input.text ?? (input.html == null ? '' : input.html.replace(/<[^>]+>/g, ' '))
  if (mixed) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    if (alternatives) {
      const alt = `${boundary}-alt`
      bodyParts.push(`--${boundary}`, `Content-Type: multipart/alternative; boundary="${alt}"`, '')
      bodyParts.push(`--${alt}`, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', text)
      bodyParts.push(`--${alt}`, 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', input.html ?? '')
      bodyParts.push(`--${alt}--`)
    } else {
      bodyParts.push(`--${boundary}`, `Content-Type: ${input.html != null ? 'text/html' : 'text/plain'}; charset=utf-8`, 'Content-Transfer-Encoding: 8bit', '', input.html ?? text)
    }
    for (const attachment of attachments) {
      const data = Buffer.isBuffer(attachment.content) ? attachment.content : Buffer.from(attachment.content)
      bodyParts.push(
        `--${boundary}`,
        `Content-Type: ${attachment.contentType ?? 'application/octet-stream'}; name="${escapeHeader(attachment.filename)}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: ${attachment.disposition ?? 'attachment'}; filename="${escapeHeader(attachment.filename)}"`,
        ...(attachment.contentId ? [`Content-ID: <${escapeHeader(attachment.contentId)}>`] : []),
        '',
        data.toString('base64').replace(/.{1,76}/g, '$&\r\n').trimEnd()
      )
    }
    bodyParts.push(`--${boundary}--`)
  } else if (alternatives) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    bodyParts.push(`--${boundary}`, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', text)
    bodyParts.push(`--${boundary}`, 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', input.html ?? '')
    bodyParts.push(`--${boundary}--`)
  } else {
    headers.push(`Content-Type: ${input.html != null ? 'text/html' : 'text/plain'}; charset=utf-8`, 'Content-Transfer-Encoding: 8bit')
    bodyParts.push(input.html ?? text)
  }
  return Buffer.from([...headers, '', ...bodyParts, ''].join(CRLF))
}

function decodeAtom(value: string): string {
  const clean = value.trim()
  if (clean.startsWith('"') && clean.endsWith('"')) return clean.slice(1, -1).replace(/\\([\\"])/g, '$1')
  return clean
}

function atoms(value: string): string[] {
  const found: string[] = []
  const pattern = /"((?:\\.|[^"\\])*)"|\(([^)]*)\)|([^\s]+)/g
  for (const match of value.matchAll(pattern)) found.push(match[1] != null ? match[1].replace(/\\([\\"])/g, '$1') : match[2] != null ? `(${match[2]})` : match[3])
  return found
}

function sequenceNumbers(set: string, max: number): number[] {
  const values = new Set<number>()
  for (const part of set.split(',')) {
    const [left, right] = part.split(':')
    const resolve = (one: string | undefined): number => (one === '*' || one == null ? max : Number(one))
    const start = resolve(left)
    const end = resolve(right)
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    const step = start <= end ? 1 : -1
    for (let one = start; one !== end + step; one += step) if (one >= 1 && one <= max) values.add(one)
  }
  return [...values].sort((a, b) => a - b)
}

function headerValue(raw: Buffer, name: string): string {
  const head = raw.toString('utf8').split(/\r?\n\r?\n/, 1)[0]
  const match = head.match(new RegExp(`^${name}:\\s*(.+(?:\\r?\\n[ \\t].+)*)$`, 'im'))
  return match?.[1].replace(/\r?\n[ \t]+/g, ' ').trim() ?? ''
}

function envelope(message: GmailStoredMessage): string {
  const from = headerValue(message.raw, 'From')
  const to = headerValue(message.raw, 'To')
  const parse = (value: string): string => {
    if (!value) return 'NIL'
    const match = value.match(/^(.*?)(?:<([^>]+)>|([^\s<>]+@[^\s<>]+))$/)
    const address = match?.[2] ?? match?.[3] ?? value
    const name = match?.[1]?.trim().replace(/^"|"$/g, '') ?? ''
    const [mailbox, host = ''] = address.split('@')
    return `((${name ? quoted(name) : 'NIL'} NIL ${quoted(mailbox)} ${quoted(host)}))`
  }
  const refs = headerValue(message.raw, 'In-Reply-To')
  return `(${quoted(message.internalDate.toUTCString())} ${quoted(headerValue(message.raw, 'Subject'))} ${parse(from)} ${parse(from)} ${parse(from)} ${parse(to)} NIL NIL ${refs ? quoted(refs) : 'NIL'} ${quoted(headerValue(message.raw, 'Message-ID'))})`
}

function bodyStructure(message: GmailStoredMessage): string {
  const type = headerValue(message.raw, 'Content-Type').toLowerCase()
  if (type.startsWith('text/html')) return `("TEXT" "HTML" ("CHARSET" "utf-8") NIL NIL "8BIT" ${message.raw.length} 1)`
  if (type.startsWith('multipart/')) return `("TEXT" "PLAIN" ("CHARSET" "utf-8") NIL NIL "8BIT" ${message.raw.length} 1 "MIXED")`
  return `("TEXT" "PLAIN" ("CHARSET" "utf-8") NIL NIL "8BIT" ${message.raw.length} 1)`
}

export class GmailLoopbackServer {
  readonly accounts = new Map<string, Account>()
  readonly smtpMessages: CapturedSmtpMessage[] = []
  readonly imapCommands: string[] = []
  readonly smtpCommands: string[] = []
  imapPort = 0
  smtpPort = 0
  private imapServer: Server | null = null
  private smtpServer: Server | null = null
  private imapSessions = new Set<ImapSession>()
  private smtpSessions = new Set<SmtpSession>()

  constructor(inputs: GmailAccountInput[]) {
    for (const input of inputs) {
      const id = input.id ?? input.email
      const account: Account = {
        id,
        email: input.email.toLowerCase(),
        password: input.password ?? 'password',
        accessToken: input.accessToken,
        name: input.name,
        messages: [],
        nextUid: 1,
        nextGmailId: 10_000_000_000_000n,
        nextThreadId: 20_000_000_000_000n,
        modseq: 1
      }
      this.accounts.set(id, account)
      for (const message of input.messages ?? []) this.add(account, message, false)
    }
  }

  get imapUrl(): string {
    return `imap://127.0.0.1:${this.imapPort}`
  }

  get smtpUrl(): string {
    return `smtp://127.0.0.1:${this.smtpPort}`
  }

  connection(accountId: string): {
    imap: { host: string; port: number; secure: false; auth: { user: string; pass: string } }
    smtp: { host: string; port: number; secure: false; auth: { user: string; pass: string } }
  } {
    const account = this.account(accountId)
    const auth = { user: account.email, pass: account.password }
    return {
      imap: { host: '127.0.0.1', port: this.imapPort, secure: false, auth },
      smtp: { host: '127.0.0.1', port: this.smtpPort, secure: false, auth }
    }
  }

  async start(): Promise<this> {
    this.imapServer = createServer(socket => this.acceptImap(socket))
    this.smtpServer = createServer(socket => this.acceptSmtp(socket))
    await Promise.all([this.listen(this.imapServer), this.listen(this.smtpServer)])
    this.imapPort = (this.imapServer.address() as { port: number }).port
    this.smtpPort = (this.smtpServer.address() as { port: number }).port
    return this
  }

  async close(): Promise<void> {
    for (const session of this.imapSessions) session.socket.destroy()
    for (const session of this.smtpSessions) session.socket.destroy()
    await Promise.all([this.stop(this.imapServer), this.stop(this.smtpServer)])
    this.imapSessions.clear()
    this.smtpSessions.clear()
    this.imapServer = null
    this.smtpServer = null
  }

  deliver(accountId: string, input: GmailMessageInput): GmailStoredMessage {
    return this.add(this.account(accountId), { ...input, labels: input.labels ?? ['INBOX'] }, true)
  }

  mailbox(accountId: string, label = 'INBOX'): GmailStoredMessage[] {
    const wanted = normalizeLabel(label)
    return this.account(accountId).messages.filter(message => message.labels.has(wanted))
  }

  disconnectImap(accountId?: string): void {
    for (const session of this.imapSessions) {
      if (!accountId || session.account?.id === accountId) session.socket.destroy()
    }
  }

  private account(id: string): Account {
    const account = this.accounts.get(id) ?? [...this.accounts.values()].find(one => one.email === id.toLowerCase())
    if (!account) throw new Error(`Unknown mail account ${id}`)
    return account
  }

  private add(account: Account, input: GmailMessageInput, notify: boolean): GmailStoredMessage {
    const message: GmailStoredMessage = {
      uid: account.nextUid++,
      gmailId: String(account.nextGmailId++),
      threadId: input.threadId ?? String(account.nextThreadId++),
      raw: mime(input),
      input,
      labels: new Set((input.labels?.length ? input.labels : ['INBOX']).map(normalizeLabel).concat('[Gmail]/All Mail')),
      flags: new Set(input.flags ?? []),
      internalDate: input.date ?? new Date(),
      modseq: ++account.modseq
    }
    account.messages.push(message)
    if (notify) this.notify(account, message)
    return message
  }

  private notify(account: Account, message: GmailStoredMessage): void {
    for (const session of this.imapSessions) {
      if (session.account !== account || !session.selected || !message.labels.has(session.selected)) continue
      const count = this.visible(session).length
      session.socket.write(`* ${count} EXISTS${CRLF}`)
      if (session.idleTag) session.socket.write(`* OK [HIGHESTMODSEQ ${account.modseq}] Changed${CRLF}`)
    }
  }

  private listen(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject)
        resolve()
      })
    })
  }

  private stop(server: Server | null): Promise<void> {
    if (!server) return Promise.resolve()
    return new Promise(resolve => server.close(() => resolve()))
  }

  private acceptImap(socket: Socket): void {
    const session: ImapSession = {
      socket,
      buffer: Buffer.alloc(0),
      account: null,
      selected: null,
      idleTag: null,
      literal: null,
      authMechanism: null,
      authTag: null,
      closed: false
    }
    this.imapSessions.add(session)
    socket.setNoDelay(true)
    socket.write(`* OK [CAPABILITY IMAP4rev1 IDLE NAMESPACE UIDPLUS MOVE CONDSTORE ENABLE X-GM-EXT-1 SPECIAL-USE LITERAL+] Crew Gmail fixture ready${CRLF}`)
    socket.on('data', chunk => {
      session.buffer = Buffer.concat([session.buffer, chunk])
      this.readImap(session)
    })
    socket.on('close', () => {
      session.closed = true
      this.imapSessions.delete(session)
    })
  }

  private readImap(session: ImapSession): void {
    while (!session.closed) {
      if (session.literal) {
        if (session.buffer.length < session.literal.length + 2) return
        const body = session.buffer.subarray(0, session.literal.length)
        session.buffer = session.buffer.subarray(session.literal.length)
        if (session.buffer.subarray(0, 2).toString() === CRLF) session.buffer = session.buffer.subarray(2)
        const line = session.literal.line
        session.literal = null
        this.imapLine(session, line, body)
        continue
      }
      const end = session.buffer.indexOf(CRLF)
      if (end < 0) return
      const line = session.buffer.subarray(0, end).toString('utf8')
      session.buffer = session.buffer.subarray(end + 2)
      const literal = line.match(/\{(\d+)(\+)?\}$/)
      if (literal) {
        session.literal = { line, length: Number(literal[1]), plus: Boolean(literal[2]) }
        if (!literal[2]) session.socket.write(`+ Continue${CRLF}`)
        continue
      }
      this.imapLine(session, line)
    }
  }

  private imapLine(session: ImapSession, line: string, literal?: Buffer): void {
    if (session.authMechanism) {
      const mechanism = session.authMechanism
      const authTag = session.authTag ?? '*'
      session.authMechanism = null
      session.authTag = null
      const decoded = Buffer.from(line, 'base64').toString()
      const user = mechanism === 'XOAUTH2' ? decoded.match(/user=([^\x01]+)/)?.[1] : decoded.split('\0').at(-2)
      const secret = mechanism === 'XOAUTH2' ? decoded.match(/auth=Bearer ([^\x01]+)/)?.[1] : decoded.split('\0').at(-1)
      const account = [...this.accounts.values()].find(
        one => one.email === user?.toLowerCase() && (one.accessToken === secret || one.password === secret)
      )
      if (!account) session.socket.write(`${authTag} NO Authentication failed${CRLF}`)
      else {
        session.account = account
        session.socket.write(`${authTag} OK AUTHENTICATE completed${CRLF}`)
      }
      return
    }
    if (session.idleTag && line.toUpperCase() === 'DONE') {
      const tag = session.idleTag
      session.idleTag = null
      session.socket.write(`${tag} OK IDLE completed${CRLF}`)
      return
    }
    this.imapCommands.push(line.replace(/^(\S+\s+(?:LOGIN|AUTHENTICATE)\s+).*/i, '$1[redacted]'))
    const match = line.match(/^(\S+)\s+(?:(UID)\s+)?(\S+)(?:\s+([\s\S]*?))?(?:\s+\{\d+\+?\})?$/i)
    if (!match) return
    const [, tag, uidWord, rawCommand, rawArgs = ''] = match
    const command = rawCommand.toUpperCase()
    const uidMode = Boolean(uidWord)
    const args = rawArgs.replace(/\s+\{\d+\+?\}$/, '')
    const ok = (text = `${command} completed`): void => void session.socket.write(`${tag} OK ${text}${CRLF}`)
    const no = (text: string): void => void session.socket.write(`${tag} NO ${text}${CRLF}`)

    if (command === 'CAPABILITY') {
      session.socket.write(`* CAPABILITY IMAP4rev1 IDLE NAMESPACE UIDPLUS MOVE CONDSTORE ENABLE X-GM-EXT-1 SPECIAL-USE LITERAL+ AUTH=PLAIN AUTH=XOAUTH2${CRLF}`)
      ok()
      return
    }
    if (command === 'NOOP') return ok()
    if (command === 'LOGOUT') {
      session.socket.write(`* BYE Closing connection${CRLF}${tag} OK LOGOUT completed${CRLF}`)
      session.socket.end()
      return
    }
    if (command === 'LOGIN') {
      const [user, password] = atoms(args).map(decodeAtom)
      const account = [...this.accounts.values()].find(one => one.email === user?.toLowerCase() && one.password === password)
      if (!account) return no('Authentication failed')
      session.account = account
      return ok('LOGIN completed')
    }
    if (command === 'AUTHENTICATE') {
      const [mechanism, encoded] = atoms(args)
      if (!encoded) {
        session.authMechanism = mechanism.toUpperCase()
        session.authTag = tag
        session.socket.write(`+ ${CRLF}`)
        return
      }
      const decoded = Buffer.from(encoded, 'base64').toString()
      const user = mechanism.toUpperCase() === 'XOAUTH2' ? decoded.match(/user=([^\x01]+)/)?.[1] : decoded.split('\0').at(-2)
      const secret = mechanism.toUpperCase() === 'XOAUTH2' ? decoded.match(/auth=Bearer ([^\x01]+)/)?.[1] : decoded.split('\0').at(-1)
      const account = [...this.accounts.values()].find(one => one.email === user?.toLowerCase() && (one.accessToken === secret || one.password === secret))
      if (!account) return no('Authentication failed')
      session.account = account
      return ok('AUTHENTICATE completed')
    }
    if (!session.account) return no('Authenticate first')
    if (command === 'NAMESPACE') {
      session.socket.write(`* NAMESPACE (("" "/")) NIL NIL${CRLF}`)
      return ok()
    }
    if (command === 'ENABLE') {
      session.socket.write(`* ENABLED ${args}${CRLF}`)
      return ok()
    }
    if (command === 'LIST' || command === 'LSUB') {
      for (const label of this.labels(session.account)) {
        const special = label === 'INBOX' ? '\\Inbox' : label === '[Gmail]/All Mail' ? '\\All' : label === '[Gmail]/Drafts' ? '\\Drafts' : label === '[Gmail]/Sent Mail' ? '\\Sent' : label === '[Gmail]/Spam' ? '\\Junk' : label === '[Gmail]/Trash' ? '\\Trash' : label === '[Gmail]/Starred' ? '\\Flagged' : ''
        session.socket.write(`* ${command} (\\HasNoChildren${special ? ` ${special}` : ''}) "/" ${quoted(label)}${CRLF}`)
      }
      return ok()
    }
    if (command === 'CREATE') {
      return ok()
    }
    if (command === 'STATUS') {
      const [mailbox] = atoms(args)
      const messages = this.mailboxFor(session.account, normalizeLabel(mailbox))
      const unseen = messages.filter(message => !message.flags.has('\\Seen')).length
      session.socket.write(`* STATUS ${quoted(normalizeLabel(mailbox))} (MESSAGES ${messages.length} UNSEEN ${unseen} UIDNEXT ${session.account.nextUid} UIDVALIDITY 1 HIGHESTMODSEQ ${session.account.modseq})${CRLF}`)
      return ok()
    }
    if (command === 'SELECT' || command === 'EXAMINE') {
      const [mailbox] = atoms(args)
      session.selected = normalizeLabel(mailbox)
      const messages = this.visible(session)
      session.socket.write(`* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)${CRLF}`)
      session.socket.write(`* OK [PERMANENTFLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft \\*)] Flags permitted${CRLF}`)
      session.socket.write(`* ${messages.length} EXISTS${CRLF}* 0 RECENT${CRLF}`)
      session.socket.write(`* OK [UIDVALIDITY 1] UIDs valid${CRLF}* OK [UIDNEXT ${session.account.nextUid}] Predicted next UID${CRLF}* OK [HIGHESTMODSEQ ${session.account.modseq}] Highest${CRLF}`)
      return ok(command === 'EXAMINE' ? '[READ-ONLY] EXAMINE completed' : '[READ-WRITE] SELECT completed')
    }
    if (command === 'UNSELECT' || command === 'CLOSE') {
      if (command === 'CLOSE') this.expunge(session)
      session.selected = null
      return ok()
    }
    if (command === 'IDLE') {
      session.idleTag = tag
      session.socket.write(`+ idling${CRLF}`)
      return
    }
    if (command === 'CHECK') return ok()
    if (command === 'SEARCH') {
      this.search(session, tag, args, uidMode)
      return
    }
    if (command === 'FETCH') {
      this.fetch(session, tag, args, uidMode)
      return
    }
    if (command === 'STORE') {
      this.store(session, tag, args, uidMode)
      return
    }
    if (command === 'COPY' || command === 'MOVE') {
      this.move(session, tag, args, uidMode, command === 'MOVE')
      return
    }
    if (command === 'EXPUNGE') {
      this.expunge(session)
      return ok()
    }
    if (command === 'APPEND') {
      const [mailbox] = atoms(args)
      const raw = literal ?? Buffer.alloc(0)
      const input: GmailMessageInput = {
        from: headerValue(raw, 'From'),
        to: headerValue(raw, 'To'),
        subject: headerValue(raw, 'Subject'),
        date: new Date(headerValue(raw, 'Date') || Date.now()),
        messageId: headerValue(raw, 'Message-ID'),
        labels: [normalizeLabel(mailbox)],
        flags: args.match(/\(([^)]*)\)/)?.[1].split(/\s+/).filter(Boolean) ?? []
      }
      const message = this.add(session.account, input, false)
      message.raw = raw
      this.notify(session.account, message)
      session.socket.write(`${tag} OK [APPENDUID 1 ${message.uid}] APPEND completed${CRLF}`)
      return
    }
    session.socket.write(`${tag} BAD Unsupported command ${command}${CRLF}`)
  }

  private labels(account: Account): string[] {
    return [...new Set([...SYSTEM_LABELS, ...account.messages.flatMap(message => [...message.labels])])]
  }

  private mailboxFor(account: Account, label: string): GmailStoredMessage[] {
    return account.messages.filter(message => message.labels.has(label))
  }

  private visible(session: ImapSession): GmailStoredMessage[] {
    return session.account && session.selected ? this.mailboxFor(session.account, session.selected) : []
  }

  private chosen(session: ImapSession, set: string, uidMode: boolean): Array<{ message: GmailStoredMessage; sequence: number }> {
    const visible = this.visible(session)
    if (!uidMode) return sequenceNumbers(set, visible.length).map(sequence => ({ message: visible[sequence - 1], sequence }))
    const highest = Math.max(0, ...visible.map(message => message.uid))
    const uids = new Set(sequenceNumbers(set, highest))
    return visible.flatMap((message, index) => (uids.has(message.uid) ? [{ message, sequence: index + 1 }] : []))
  }

  private search(session: ImapSession, tag: string, args: string, uidMode: boolean): void {
    let messages = this.visible(session)
    const rawMatch = args.match(/X-GM-RAW\s+(?:"((?:\\.|[^"\\])*)"|(\S+))/i)
    if (rawMatch) {
      const query = (rawMatch[1] ?? rawMatch[2]).replace(/\\"/g, '"')
      messages = messages.filter(message => this.matchesRaw(message, query))
    }
    const uidMatch = args.match(/\bUID\s+([\d*:,-]+)/i)
    if (uidMatch) {
      const highest = Math.max(0, ...messages.map(message => message.uid))
      const wanted = new Set(sequenceNumbers(uidMatch[1], highest))
      messages = messages.filter(message => wanted.has(message.uid))
    }
    if (/\bUNSEEN\b/i.test(args)) messages = messages.filter(message => !message.flags.has('\\Seen'))
    if (/\bSEEN\b/i.test(args) && !/\bUNSEEN\b/i.test(args)) messages = messages.filter(message => message.flags.has('\\Seen'))
    const visible = this.visible(session)
    const values = messages.map(message => (uidMode ? message.uid : visible.indexOf(message) + 1))
    session.socket.write(`* SEARCH${values.length ? ` ${values.join(' ')}` : ''}${CRLF}${tag} OK SEARCH completed${CRLF}`)
  }

  private matchesRaw(message: GmailStoredMessage, query: string): boolean {
    const haystack = message.raw.toString('utf8').toLowerCase()
    const terms = query.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []
    return terms.every(rawTerm => {
      let term = rawTerm.replace(/^"|"$/g, '')
      let invert = false
      if (term.startsWith('-')) {
        invert = true
        term = term.slice(1)
      }
      const [field, ...rest] = term.split(':')
      const value = rest.join(':').toLowerCase()
      let matched: boolean
      if (!rest.length) matched = haystack.includes(field.toLowerCase())
      else if (field === 'from' || field === 'to' || field === 'cc' || field === 'subject') matched = headerValue(message.raw, field).toLowerCase().includes(value)
      else if (field === 'label') matched = [...message.labels].some(label => label.toLowerCase() === value)
      else if (field === 'is' && value === 'unread') matched = !message.flags.has('\\Seen')
      else if (field === 'is' && value === 'read') matched = message.flags.has('\\Seen')
      else if (field === 'is' && value === 'starred') matched = message.flags.has('\\Flagged') || message.labels.has('[Gmail]/Starred')
      else if (field === 'has' && value === 'attachment') matched = /content-disposition:\s*attachment/i.test(haystack)
      else if (field === 'in') matched = [...message.labels].some(label => label.toLowerCase().includes(value))
      else matched = haystack.includes(value)
      return invert ? !matched : matched
    })
  }

  private fetch(session: ImapSession, tag: string, args: string, uidMode: boolean): void {
    const [set] = atoms(args)
    const upper = args.toUpperCase()
    for (const { message, sequence } of this.chosen(session, set, uidMode)) {
      const fields: string[] = []
      if (uidMode || /\bUID\b/.test(upper)) fields.push(`UID ${message.uid}`)
      if (/\bFLAGS\b/.test(upper)) fields.push(`FLAGS (${[...message.flags].join(' ')})`)
      if (/X-GM-MSGID/.test(upper)) fields.push(`X-GM-MSGID ${message.gmailId}`)
      if (/X-GM-THRID/.test(upper)) fields.push(`X-GM-THRID ${message.threadId}`)
      if (/X-GM-LABELS/.test(upper)) fields.push(`X-GM-LABELS (${[...message.labels].map(quoted).join(' ')})`)
      if (/INTERNALDATE/.test(upper)) fields.push(`INTERNALDATE ${quoted(message.internalDate.toUTCString())}`)
      if (/RFC822\.SIZE/.test(upper)) fields.push(`RFC822.SIZE ${message.raw.length}`)
      if (/ENVELOPE/.test(upper)) fields.push(`ENVELOPE ${envelope(message)}`)
      if (/BODYSTRUCTURE/.test(upper)) fields.push(`BODYSTRUCTURE ${bodyStructure(message)}`)
      if (/MODSEQ/.test(upper)) fields.push(`MODSEQ (${message.modseq})`)
      const body = upper.match(/BODY(?:\.PEEK)?\[([^\]]*)\]/)
      if (body) {
        const section = body[1]
        let value = message.raw
        if (section === 'HEADER') value = Buffer.from(message.raw.toString('utf8').split(/\r?\n\r?\n/)[0] + CRLF + CRLF)
        if (section === 'TEXT') value = Buffer.from(message.raw.toString('utf8').split(/\r?\n\r?\n/).slice(1).join(CRLF + CRLF))
        const label = `BODY[${section}]`
        session.socket.write(`* ${sequence} FETCH (${fields.length ? `${fields.join(' ')} ` : ''}${label} {${value.length}}${CRLF}`)
        session.socket.write(value)
        session.socket.write(`)${CRLF}`)
      } else {
        session.socket.write(`* ${sequence} FETCH (${fields.join(' ')})${CRLF}`)
      }
    }
    session.socket.write(`${tag} OK FETCH completed${CRLF}`)
  }

  private store(session: ImapSession, tag: string, args: string, uidMode: boolean): void {
    const [set, operation] = atoms(args)
    const values = args.match(/\(([^)]*)\)/)?.[1].match(/"(?:\\.|[^"\\])*"|[^\s]+/g)?.map(decodeAtom) ?? []
    const add = operation.startsWith('+')
    const remove = operation.startsWith('-')
    const labels = operation.toUpperCase().includes('X-GM-LABELS')
    for (const { message, sequence } of this.chosen(session, set, uidMode)) {
      const target = labels ? message.labels : message.flags
      if (!add && !remove) target.clear()
      for (const value of values.map(one => (labels ? normalizeLabel(one) : one))) {
        if (remove) target.delete(value)
        else target.add(value)
      }
      message.modseq = ++session.account!.modseq
      if (!operation.toUpperCase().includes('.SILENT')) {
        session.socket.write(`* ${sequence} FETCH (UID ${message.uid} FLAGS (${[...message.flags].join(' ')}) X-GM-LABELS (${[...message.labels].map(quoted).join(' ')}) MODSEQ (${message.modseq}))${CRLF}`)
      }
    }
    session.socket.write(`${tag} OK STORE completed${CRLF}`)
  }

  private move(session: ImapSession, tag: string, args: string, uidMode: boolean, removeSource: boolean): void {
    const [set, rawDestination] = atoms(args)
    const destination = normalizeLabel(rawDestination)
    const source = session.selected
    const chosen = this.chosen(session, set, uidMode)
    for (const { message } of chosen) {
      message.labels.add(destination)
      if (removeSource && source) message.labels.delete(source)
      message.modseq = ++session.account!.modseq
    }
    const uids = chosen.map(one => one.message.uid).join(',')
    session.socket.write(`${tag} OK [COPYUID 1 ${uids} ${uids}] ${removeSource ? 'MOVE' : 'COPY'} completed${CRLF}`)
  }

  private expunge(session: ImapSession): void {
    const account = session.account
    if (!account) return
    let sequence = 1
    for (const message of [...this.visible(session)]) {
      if (!message.flags.has('\\Deleted')) {
        sequence++
        continue
      }
      const index = account.messages.indexOf(message)
      if (index >= 0) account.messages.splice(index, 1)
      session.socket.write(`* ${sequence} EXPUNGE${CRLF}`)
    }
  }

  private acceptSmtp(socket: Socket): void {
    const session: SmtpSession = { socket, buffer: Buffer.alloc(0), account: null, from: '', recipients: [], data: null, authUser: null }
    this.smtpSessions.add(session)
    socket.setNoDelay(true)
    socket.write(`220 crew.test ESMTP Crew fixture${CRLF}`)
    socket.on('data', chunk => {
      session.buffer = Buffer.concat([session.buffer, chunk])
      this.readSmtp(session)
    })
    socket.on('close', () => this.smtpSessions.delete(session))
  }

  private readSmtp(session: SmtpSession): void {
    while (true) {
      const end = session.buffer.indexOf(CRLF)
      if (end < 0) return
      const line = session.buffer.subarray(0, end).toString('utf8')
      session.buffer = session.buffer.subarray(end + 2)
      if (session.data) {
        if (line !== '.') {
          session.data.push(line.startsWith('..') ? line.slice(1) : line)
          continue
        }
        const raw = Buffer.from(session.data.join(CRLF) + CRLF)
        this.smtpMessages.push({ accountId: session.account?.id ?? null, envelope: { from: session.from, to: [...session.recipients] }, raw })
        for (const recipient of session.recipients) {
          const account = [...this.accounts.values()].find(one => one.email === recipient.toLowerCase())
          if (!account) continue
          const input: GmailMessageInput = {
            from: headerValue(raw, 'From') || session.from,
            to: headerValue(raw, 'To') || recipient,
            subject: headerValue(raw, 'Subject'),
            date: new Date(headerValue(raw, 'Date') || Date.now()),
            messageId: headerValue(raw, 'Message-ID'),
            labels: ['INBOX']
          }
          const delivered = this.add(account, input, false)
          delivered.raw = raw
          this.notify(account, delivered)
        }
        session.data = null
        session.from = ''
        session.recipients = []
        session.socket.write(`250 2.0.0 queued${CRLF}`)
        continue
      }
      this.smtpLine(session, line)
    }
  }

  private smtpLine(session: SmtpSession, line: string): void {
    this.smtpCommands.push(line.replace(/^(AUTH\s+\S+\s+).*/i, '$1[redacted]'))
    const [rawCommand, ...parts] = line.split(' ')
    const command = rawCommand.toUpperCase()
    const args = parts.join(' ')
    if (command === 'EHLO' || command === 'HELO') {
      session.socket.write(`250-crew.test${CRLF}250-AUTH PLAIN LOGIN XOAUTH2${CRLF}250-8BITMIME${CRLF}250 SIZE 52428800${CRLF}`)
      return
    }
    if (command === 'AUTH') {
      const [mechanism, encoded] = parts
      if (mechanism?.toUpperCase() === 'LOGIN' && !encoded) {
        session.authUser = ''
        session.socket.write(`334 VXNlcm5hbWU6${CRLF}`)
        return
      }
      const decoded = Buffer.from(encoded ?? '', 'base64').toString()
      const user = mechanism?.toUpperCase() === 'XOAUTH2' ? decoded.match(/user=([^\x01]+)/)?.[1] : decoded.split('\0').at(-2)
      const secret = mechanism?.toUpperCase() === 'XOAUTH2' ? decoded.match(/auth=Bearer ([^\x01]+)/)?.[1] : decoded.split('\0').at(-1)
      const account = [...this.accounts.values()].find(one => one.email === user?.toLowerCase() && (one.password === secret || one.accessToken === secret))
      if (!account) session.socket.write(`535 5.7.8 Authentication failed${CRLF}`)
      else {
        session.account = account
        session.socket.write(`235 2.7.0 Authentication successful${CRLF}`)
      }
      return
    }
    if (session.authUser != null && !session.account) {
      if (session.authUser === '') {
        session.authUser = Buffer.from(line, 'base64').toString().toLowerCase()
        session.socket.write(`334 UGFzc3dvcmQ6${CRLF}`)
      } else {
        const password = Buffer.from(line, 'base64').toString()
        session.account = [...this.accounts.values()].find(one => one.email === session.authUser && one.password === password) ?? null
        session.authUser = null
        session.socket.write(session.account ? `235 2.7.0 Authentication successful${CRLF}` : `535 5.7.8 Authentication failed${CRLF}`)
      }
      return
    }
    if (command === 'MAIL') {
      session.from = args.match(/FROM:\s*<([^>]*)>/i)?.[1] ?? ''
      session.socket.write(`250 2.1.0 OK${CRLF}`)
      return
    }
    if (command === 'RCPT') {
      const recipient = args.match(/TO:\s*<([^>]*)>/i)?.[1]
      if (recipient) session.recipients.push(recipient.toLowerCase())
      session.socket.write(`250 2.1.5 OK${CRLF}`)
      return
    }
    if (command === 'DATA') {
      session.data = []
      session.socket.write(`354 End data with <CR><LF>.<CR><LF>${CRLF}`)
      return
    }
    if (command === 'RSET') {
      session.from = ''
      session.recipients = []
      session.data = null
      session.socket.write(`250 2.0.0 OK${CRLF}`)
      return
    }
    if (command === 'NOOP') {
      session.socket.write(`250 2.0.0 OK${CRLF}`)
      return
    }
    if (command === 'QUIT') {
      session.socket.end(`221 2.0.0 Bye${CRLF}`)
      return
    }
    session.socket.write(`502 5.5.2 Command not recognized${CRLF}`)
  }
}

export async function startGmailImapServer(accounts: GmailAccountInput[] | GmailAccountInput): Promise<GmailLoopbackServer> {
  return new GmailLoopbackServer(Array.isArray(accounts) ? accounts : [accounts]).start()
}
