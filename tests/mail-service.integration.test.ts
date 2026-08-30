import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { simpleParser } from 'mailparser'
import { GmailTransport } from '../src/main/mail/gmail'
import { MailDatabase } from '../src/main/mail/database'
import { MailFileStore } from '../src/main/mail/files'
import { GmailMailConnection, MailDatabaseServiceStore, MailService } from '../src/main/mail/service'
import type { MailCredentials } from '../src/shared/mail'
import { startGmailImapServer, type GmailLoopbackServer } from './helpers/gmail-imap-server'

const openServers: GmailLoopbackServer[] = []
const openClients: ImapFlow[] = []
const openTransports: GmailTransport[] = []
const runtimes: ServiceHarness[] = []

const message = (subject: string, from: string, labels = ['INBOX']) => ({
  from,
  to: 'jamel@gmail.com',
  subject,
  text: `${subject} in plain text`,
  html: `<p>${subject} in HTML</p>`,
  labels,
  date: new Date('2026-08-28T12:00:00Z')
})

async function fixture(): Promise<GmailLoopbackServer> {
  const server = await startGmailImapServer([
    {
      id: 'personal',
      email: 'jamel@gmail.com',
      password: 'aaaa bbbb cccc dddd',
      messages: [
        message('Dinner this weekend', 'Ali <ali@example.com>'),
        { ...message('Crew receipt', 'Receipts <pay@example.com>', ['INBOX', 'Receipts']), flags: ['\\Seen'] }
      ]
    },
    {
      id: 'work',
      email: 'jamel@crew.test',
      password: 'eeee ffff gggg hhhh',
      messages: [message('Release checklist', 'Sam <sam@crew.test>')]
    }
  ])
  openServers.push(server)
  return server
}

async function connect(server: GmailLoopbackServer, accountId: string): Promise<ImapFlow> {
  const options = server.connection(accountId).imap
  const client = new ImapFlow({ ...options, doSTARTTLS: false, logger: false, disableAutoIdle: true })
  client.on('error', () => {})
  await client.connect()
  openClients.push(client)
  return client
}

afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.close()
  for (const transport of openTransports.splice(0)) await transport.close().catch(() => {})
  for (const client of openClients.splice(0)) {
    if (client.usable) await client.logout().catch(() => {})
  }
  for (const server of openServers.splice(0)) await server.close()
})

type ServiceHarness = {
  service: MailService
  database: MailDatabase
  credentials: Map<string, MailCredentials>
  server: GmailLoopbackServer
  setNow(value: number): void
  close(): Promise<void>
}

async function serviceHarness(): Promise<ServiceHarness> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'crew-mail-service-'))
  const server = await startGmailImapServer([
    {
      id: 'personal-remote',
      email: 'jamel@gmail.com',
      password: 'aaaabbbbccccdddd',
      messages: [message('Dinner this weekend', 'Ali <ali@example.com>')]
    },
    {
      id: 'work-remote',
      email: 'jamel@crew.test',
      password: 'eeeeffffgggghhhh',
      messages: [message('Release checklist', 'Sam <sam@crew.test>')]
    }
  ])
  const database = new MailDatabase(directory)
  const files = new MailFileStore(directory)
  const store = new MailDatabaseServiceStore(database, files)
  const credentials = new Map<string, MailCredentials>()
  let now = Date.now()
  const service = new MailService({
    store,
    files,
    credentials: {
      get: accountId => credentials.get(accountId) ?? null,
      set: (accountId, value) => credentials.set(accountId, value as MailCredentials),
      delete: accountId => credentials.delete(accountId)
    },
    connect: (account, secret) => new GmailMailConnection({
      account,
      credentials: secret,
      store,
      files,
      transport: {
        imap: { host: '127.0.0.1', port: server.imapPort, secure: false, startTLS: false },
        smtp: { host: '127.0.0.1', port: server.smtpPort, secure: false, startTLS: false },
        connectionTimeoutMs: 2_000,
        reconnectDelayMs: 5,
        reconnectMaxDelayMs: 10
      }
    }),
    clock: () => now
  })
  await service.start()
  const harness: ServiceHarness = {
    service,
    database,
    credentials,
    server,
    setNow: value => {
      now = value
    },
    async close() {
      await service.stop().catch(() => {})
      database.close()
      await server.close()
      fs.rmSync(directory, { recursive: true, force: true })
    }
  }
  runtimes.push(harness)
  return harness
}

async function connectServiceAccounts(runtime: ServiceHarness) {
  const personalAccount = await runtime.service.connectAccount({
    email: 'jamel@gmail.com',
    displayName: 'Jamel',
    appPassword: 'aaaa bbbb cccc dddd'
  })
  const workAccount = await runtime.service.connectAccount({
    email: 'jamel@crew.test',
    displayName: 'Jamel at Crew',
    appPassword: 'eeee ffff gggg hhhh'
  })
  return { personalAccount, workAccount }
}

async function transport(server: GmailLoopbackServer, accountId: string, overrides: Record<string, unknown> = {}) {
  const account = server.accounts.get(accountId)!
  const mail = new GmailTransport({
    auth: { user: account.email, pass: account.password },
    imap: { host: '127.0.0.1', port: server.imapPort, secure: false, startTLS: false },
    smtp: { host: '127.0.0.1', port: server.smtpPort, secure: false, startTLS: false },
    connectionTimeoutMs: 2_000,
    ...overrides
  })
  await mail.connect()
  openTransports.push(mail)
  return mail
}

describe('the Gmail loopback fixture', () => {
  it('keeps two accounts separate while both are read into one view', async () => {
    const server = await fixture()
    const personal = await connect(server, 'personal')
    const work = await connect(server, 'work')

    const lock = await personal.getMailboxLock('INBOX')
    await work.mailboxOpen('INBOX')
    const personalMail = await personal.fetchAll('1:*', {
      uid: true,
      envelope: true,
      flags: true,
      labels: true,
      threadId: true,
      bodyStructure: true,
      internalDate: true,
      size: true,
      source: true
    })
    const workMail = await work.fetchAll('1:*', { uid: true, envelope: true, flags: true, labels: true, source: true })

    expect(personalMail.map(one => one.envelope?.subject)).toEqual(['Dinner this weekend', 'Crew receipt'])
    expect(workMail.map(one => one.envelope?.subject)).toEqual(['Release checklist'])
    expect([...personalMail[0].labels!]).toContain('INBOX')
    expect(personalMail[0].emailId).toMatch(/^\d+$/)
    expect(personalMail[0].threadId).toMatch(/^\d+$/)
    expect((await simpleParser(personalMail[0].source!)).html).toContain('Dinner this weekend')
    lock.release()
  })

  it('supports incremental fetches, Gmail search, flags, labels, and mailbox moves', async () => {
    const server = await fixture()
    const client = await connect(server, 'personal')
    await client.mailboxOpen('INBOX')
    const before = await client.fetchAll('1:*', { uid: true })
    const delivered = server.deliver('personal', {
      ...message('Flight plan', 'Sam <sam@example.com>'),
      attachments: [{ filename: 'route.txt', content: 'north' }]
    })

    const fresh = await client.fetchAll(`${before.at(-1)!.uid + 1}:*`, { uid: true, envelope: true }, { uid: true })
    expect(fresh.map(one => one.uid)).toEqual([delivered.uid])
    expect(await client.search({ gmraw: 'from:sam@example.com has:attachment is:unread' }, { uid: true })).toEqual([
      delivered.uid
    ])

    await client.messageFlagsAdd([delivered.uid], ['\\Seen', '\\Flagged'], { uid: true })
    await client.messageFlagsAdd([delivered.uid], ['Travel'], { uid: true, useLabels: true })
    const changed = await client.fetchOne(String(delivered.uid), { uid: true, flags: true, labels: true }, { uid: true })
    expect([...(changed && changed.flags ? changed.flags : [])]).toEqual(expect.arrayContaining(['\\Seen', '\\Flagged']))
    expect([...(changed && changed.labels ? changed.labels : [])]).toContain('Travel')

    await client.messageMove([delivered.uid], '[Gmail]/Trash', { uid: true })
    expect(server.mailbox('personal', 'INBOX').map(one => one.uid)).not.toContain(delivered.uid)
    expect(server.mailbox('personal', '[Gmail]/Trash').map(one => one.uid)).toContain(delivered.uid)
  })

  it('wakes an idle client when mail arrives and accepts a new client after a dropped connection', async () => {
    const server = await fixture()
    const client = await connect(server, 'personal')
    await client.mailboxOpen('INBOX')
    const arrived = new Promise<number>(resolve => client.once('exists', data => resolve(data.count)))
    const idle = client.idle()
    await new Promise(resolve => setTimeout(resolve, 20))
    server.deliver('personal', message('Live delivery', 'Ari <ari@example.com>'))

    expect(await arrived).toBe(3)
    await client.noop()
    await idle
    server.disconnectImap('personal')
    await new Promise(resolve => client.once('close', resolve))

    const reconnected = await connect(server, 'personal')
    const inbox = await reconnected.mailboxOpen('INBOX')
    expect(inbox.exists).toBe(3)
  })

  it('appends drafts and captures sent replies with attachments', async () => {
    const server = await fixture()
    const client = await connect(server, 'personal')
    const rawDraft = [
      'From: Jamel <jamel@gmail.com>',
      'To: Ali <ali@example.com>',
      'Subject: Re: Dinner this weekend',
      'Message-ID: <draft@crew.test>',
      'In-Reply-To: <dinner@example.com>',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Saturday works.'
    ].join('\r\n')
    const appended = await client.append('[Gmail]/Drafts', rawDraft, ['\\Draft'])

    expect(appended && appended.uid).toBeTypeOf('number')
    expect(server.mailbox('personal', '[Gmail]/Drafts').at(-1)?.raw.toString()).toContain('Saturday works.')

    const transport = nodemailer.createTransport(server.connection('personal').smtp)
    await transport.sendMail({
      from: 'Jamel <jamel@gmail.com>',
      to: 'Ali <ali@example.com>',
      subject: 'Re: Dinner this weekend',
      text: 'Saturday works.',
      inReplyTo: '<dinner@example.com>',
      attachments: [{ filename: 'menu.txt', content: 'pasta' }]
    })
    const captured = server.smtpMessages.at(-1)!
    const parsed = await simpleParser(captured.raw)
    expect(captured.accountId).toBe('personal')
    expect(captured.envelope.to).toEqual(['ali@example.com'])
    expect(parsed.inReplyTo).toBe('<dinner@example.com>')
    expect(parsed.attachments[0].filename).toBe('menu.txt')
    expect(parsed.attachments[0].content.toString()).toBe('pasta')
  })
})

describe('Gmail transport over loopback', () => {
  it('loads each account, searches remotely, and fetches complete message bodies', async () => {
    const server = await fixture()
    const personal = await transport(server, 'personal')
    const work = await transport(server, 'work')

    const personalMailboxes = await personal.listMailboxes()
    const personalInbox = await personal.fetchSummaries('INBOX', { uids: [1, 2] })
    const workInbox = await work.fetchSummaries('INBOX', { uids: [1] })
    expect(personalMailboxes.find(mailbox => mailbox.specialUse === '\\Inbox')?.path).toBe('INBOX')
    expect(personalInbox.map(one => one.subject)).toEqual(['Crew receipt', 'Dinner this weekend'])
    expect(workInbox.map(one => one.subject)).toEqual(['Release checklist'])
    expect(personalInbox.every(one => one.gmailMessageId && one.gmailThreadId)).toBe(true)

    const matches = await personal.search('INBOX', 'from:ali@example.com is:unread')
    expect(matches).toHaveLength(1)
    const body = await personal.fetchBody('INBOX', matches[0])
    expect(body.text).toContain('Dinner this weekend in plain text')
    expect(body.html).toContain('Dinner this weekend in HTML')
  })

  it('applies read, star, label, archive, spam, and trash changes to the remote account', async () => {
    const server = await fixture()
    const mail = await transport(server, 'personal')
    const [dinner, receipt] = await mail.fetchSummaries('INBOX', { uids: [1, 2] })
    const target = dinner.subject === 'Dinner this weekend' ? dinner : receipt
    const other = target === dinner ? receipt : dinner

    await mail.setRead('INBOX', target.uid, true)
    await mail.setStarred('INBOX', target.uid, true)
    await mail.addLabels('INBOX', target.uid, ['Friends'])
    let changed = await mail.fetchSummaries('INBOX', { uids: [target.uid] })
    expect(changed[0]).toMatchObject({ read: true, starred: true })
    expect(changed[0].labels).toContain('Friends')

    await mail.archive('INBOX', target.uid)
    await mail.spam('INBOX', other.uid)
    expect(server.mailbox('personal', 'INBOX').map(one => one.uid)).toEqual([])
    expect(server.mailbox('personal', '[Gmail]/Spam').map(one => one.uid)).toContain(other.uid)

    await mail.trash('[Gmail]/Spam', other.uid)
    expect(server.mailbox('personal', '[Gmail]/Spam').map(one => one.uid)).not.toContain(other.uid)
    expect(server.mailbox('personal', '[Gmail]/Trash').map(one => one.uid)).toContain(other.uid)
  })

  it('saves and replaces a reply draft, then sends it with its attachment', async () => {
    const server = await fixture()
    const mail = await transport(server, 'personal')
    const first = await mail.appendDraft({
      to: 'ali@example.com',
      subject: 'Re: Dinner this weekend',
      text: 'Friday could work.',
      inReplyTo: '<dinner@example.com>',
      references: ['<dinner@example.com>']
    })
    const replacement = await mail.replaceDraft(first.uid!, {
      to: 'ali@example.com',
      subject: 'Re: Dinner this weekend',
      text: 'Saturday works.',
      inReplyTo: '<dinner@example.com>',
      references: ['<dinner@example.com>']
    })

    expect(replacement.uid).not.toBe(first.uid)
    expect(
      server.mailbox('personal', '[Gmail]/Drafts').map(one => ({ uid: one.uid, flags: [...one.flags] }))
    ).toEqual([{ uid: replacement.uid, flags: ['\\Draft'] }])

    const sent = await mail.send({
      to: 'ali@example.com',
      subject: 'Re: Dinner this weekend',
      text: 'Saturday works.',
      inReplyTo: '<dinner@example.com>',
      references: ['<dinner@example.com>'],
      attachments: [{ filename: 'menu.txt', content: 'pasta', contentType: 'text/plain' }]
    })
    expect(sent.accepted).toEqual(['ali@example.com'])
    const parsed = await simpleParser(server.smtpMessages.at(-1)!.raw)
    expect(parsed.text).toContain('Saturday works.')
    expect(parsed.attachments[0].filename).toBe('menu.txt')
  })

  it('reports live mail and restores its watched mailbox after reconnecting', async () => {
    const server = await fixture()
    const changes: string[] = []
    const reconnects: number[] = []
    const mail = await transport(server, 'personal', {
      reconnectDelayMs: 5,
      reconnectMaxDelayMs: 10,
      onChange: (event: { type: string }) => changes.push(event.type),
      onReconnect: (attempt: number) => reconnects.push(attempt)
    })
    await mail.watch('INBOX')
    server.deliver('personal', message('Live service mail', 'Lee <lee@example.com>'))
    await expect.poll(() => changes).toContain('exists')

    server.disconnectImap('personal')
    await expect.poll(() => reconnects.length).toBe(1)
    const summaries = await mail.fetchSummaries('INBOX', { search: 'subject:"Live service mail"' })
    expect(summaries.map(one => one.subject)).toEqual(['Live service mail'])
  })
})
