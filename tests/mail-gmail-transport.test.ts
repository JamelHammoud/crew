import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  createGmailTransport,
  GmailTransportError,
  gmailImapConnectionOptions,
  gmailSmtpConnectionOptions,
  validateGmailAccount,
  type GmailTransportDependencies,
  type GmailTransportOptions
} from '../src/main/mail/gmail'

const auth = { user: 'person@gmail.com', pass: 'app-password' }

const mailboxes = [
  {
    path: 'INBOX',
    name: 'INBOX',
    delimiter: '/',
    parentPath: '',
    flags: new Set<string>(),
    specialUse: '\\Inbox',
    subscribed: true,
    status: { messages: 4, unseen: 2, uidNext: 5, uidValidity: 9n, highestModseq: 12n }
  },
  {
    path: '[Gmail]/Drafts',
    name: 'Drafts',
    delimiter: '/',
    parentPath: '[Gmail]',
    flags: new Set<string>(),
    specialUse: '\\Drafts',
    subscribed: true
  },
  {
    path: '[Gmail]/Trash',
    name: 'Trash',
    delimiter: '/',
    parentPath: '[Gmail]',
    flags: new Set<string>(),
    specialUse: '\\Trash',
    subscribed: true
  },
  {
    path: '[Gmail]/Spam',
    name: 'Spam',
    delimiter: '/',
    parentPath: '[Gmail]',
    flags: new Set<string>(),
    specialUse: '\\Junk',
    subscribed: true
  }
]

function fakeImap() {
  const events = new EventEmitter()
  const value = {
    usable: false,
    authenticated: false as string | boolean,
    capabilities: new Map<string, boolean | number>([['X-GM-EXT-1', true]]),
    mailbox: false as false | { path: string; exists: number },
    connect: vi.fn(async () => {
      value.usable = true
      value.authenticated = auth.user
    }),
    logout: vi.fn(async () => {
      value.usable = false
      value.authenticated = false
    }),
    close: vi.fn(() => {
      value.usable = false
    }),
    list: vi.fn(async () => mailboxes),
    getMailboxLock: vi.fn(async (path: string) => {
      value.mailbox = { path, exists: 4 }
      return { release: vi.fn() }
    }),
    mailboxOpen: vi.fn(async (path: string) => {
      value.mailbox = { path, exists: 4 }
      return {}
    }),
    mailboxCreate: vi.fn(async (path: string) => ({ path, created: true, mailboxId: 'box-1' })),
    mailboxSubscribe: vi.fn(async () => true),
    fetchAll: vi.fn(async () => [
      {
        seq: 2,
        uid: 22,
        emailId: '1789000000000001',
        threadId: '1789000000000002',
        labels: new Set(['\\Inbox', 'Work']),
        size: 840,
        flags: new Set(['\\Seen', '\\Flagged']),
        envelope: {
          subject: 'The subject',
          messageId: '<message@example.com>',
          from: [{ name: 'Sender', address: 'sender@example.com' }],
          to: [{ address: auth.user }],
          date: new Date('2026-08-29T12:00:00Z')
        },
        bodyStructure: { childNodes: [{ disposition: 'attachment' }] },
        internalDate: new Date('2026-08-29T12:01:00Z')
      }
    ]),
    fetchOne: vi.fn(async () => ({
      seq: 2,
      uid: 22,
      emailId: '1789000000000001',
      threadId: '1789000000000002',
      labels: new Set(['\\Inbox']),
      flags: new Set(['\\Seen']),
      envelope: { subject: 'The subject' },
      source: Buffer.from('raw message')
    })),
    search: vi.fn(async () => [22]),
    messageMove: vi.fn(async () => true),
    messageDelete: vi.fn(async () => true),
    messageFlagsAdd: vi.fn(async () => true),
    messageFlagsRemove: vi.fn(async () => true),
    messageFlagsSet: vi.fn(async () => true),
    append: vi.fn(async (path: string) => ({ destination: path, uidValidity: 9n, uid: 30 })),
    on(event: string, listener: (...args: unknown[]) => void) {
      events.on(event, listener)
      return value
    },
    emit(event: string, data?: unknown) {
      events.emit(event, data)
    }
  }
  return value
}

function harness(imaps = [fakeImap()]) {
  let imapIndex = 0
  const smtp = {
    verify: vi.fn(async () => true),
    sendMail: vi.fn(async () => ({
      messageId: '<sent@example.com>',
      accepted: [{ address: 'to@example.com' }],
      rejected: [],
      pending: [],
      response: '250 accepted'
    })),
    close: vi.fn()
  }
  const parseMime = vi.fn(async () => ({
    text: 'Plain body',
    html: '<p>HTML body</p>',
    references: ['<first@example.com>'],
    headerLines: [{ key: 'subject', line: 'Subject: The subject' }],
    attachments: [
      {
        filename: 'notes.txt',
        contentType: 'text/plain',
        contentDisposition: 'attachment',
        size: 5,
        checksum: 'checksum',
        content: Buffer.from('notes')
      }
    ]
  }))
  const composeMime = vi.fn(async () => Buffer.from('composed mime'))
  const dependencies = {
    createImap: vi.fn(() => imaps[Math.min(imapIndex++, imaps.length - 1)]),
    createSmtp: vi.fn(() => smtp),
    parseMime,
    composeMime
  } as unknown as GmailTransportDependencies
  return { imap: imaps[0], smtp, dependencies, parseMime, composeMime }
}

describe('Gmail connection settings', () => {
  it('uses encrypted Gmail endpoints and suppresses protocol logging', () => {
    const options: GmailTransportOptions = { auth }
    expect(gmailImapConnectionOptions(options)).toMatchObject({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      servername: 'imap.gmail.com',
      logger: false,
      logRaw: false,
      emitLogs: false,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: 'imap.gmail.com' }
    })
    expect(gmailSmtpConnectionOptions(options)).toMatchObject({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      requireTLS: false,
      ignoreTLS: false,
      logger: false,
      debug: false,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: 'smtp.gmail.com' }
    })
  })

  it('allows cleartext loopback endpoints without opportunistic TLS', () => {
    const options: GmailTransportOptions = {
      auth,
      imap: { host: '127.0.0.1', port: 1143, secure: false },
      smtp: { host: '127.0.0.1', port: 1025, secure: false }
    }
    expect(gmailImapConnectionOptions(options)).toMatchObject({
      host: '127.0.0.1',
      port: 1143,
      secure: false,
      doSTARTTLS: false
    })
    expect(gmailImapConnectionOptions(options)).not.toHaveProperty('servername')
    expect(gmailSmtpConnectionOptions(options)).toMatchObject({
      host: '127.0.0.1',
      port: 1025,
      secure: false,
      requireTLS: false,
      ignoreTLS: true
    })
  })
})

describe('Gmail account validation', () => {
  it('accepts an account only after IMAP and SMTP both verify', async () => {
    const { dependencies, imap, smtp } = harness()
    const transport = await createGmailTransport({ auth }, dependencies)
    expect(imap.connect).toHaveBeenCalledOnce()
    expect(imap.list).toHaveBeenCalledOnce()
    expect(smtp.verify).toHaveBeenCalledOnce()
    expect(transport.connected).toBe(true)
    await transport.close()
  })

  it('returns discovered special-use mailboxes from a validation pass', async () => {
    const { dependencies, imap, smtp } = harness()
    const result = await validateGmailAccount({ auth }, dependencies)
    expect(result.mailboxes.map(entry => entry.specialUse)).toContain('\\Drafts')
    expect(result.mailboxes[0]).toMatchObject({
      path: 'INBOX',
      messages: 4,
      unseen: 2,
      uidValidity: '9',
      highestModseq: '12'
    })
    expect(imap.logout).toHaveBeenCalledOnce()
    expect(smtp.close).toHaveBeenCalledOnce()
  })

  it('does not return library errors or credentials when validation fails', async () => {
    const { dependencies, imap, smtp } = harness()
    imap.connect.mockRejectedValueOnce(new Error(`IMAP rejected ${auth.pass}`))
    smtp.verify.mockRejectedValueOnce(new Error(`SMTP rejected ${auth.pass}`))
    const failure = createGmailTransport({ auth }, dependencies)
    await expect(failure).rejects.toMatchObject({ code: 'ACCOUNT_VALIDATION_FAILED' })
    await expect(failure).rejects.not.toThrow(auth.pass)
  })
})

describe('Gmail IMAP behavior', () => {
  it('uses a valid sequence range for the latest messages', async () => {
    const { dependencies, imap } = harness()
    const transport = await createGmailTransport({ auth }, dependencies)
    await transport.fetchSummaries('INBOX', { limit: 2 })
    expect(imap.fetchAll).toHaveBeenCalledWith('3:*', expect.any(Object), { uid: false })
    await transport.close()
  })

  it('fetches Gmail summary fields and parses complete MIME bodies', async () => {
    const { dependencies, imap, parseMime } = harness()
    const transport = await createGmailTransport({ auth }, dependencies)
    const summaries = await transport.fetchSummaries('INBOX', { search: 'label:work', limit: 10 })
    expect(imap.search).toHaveBeenCalledWith({ gmraw: 'label:work' }, { uid: true })
    expect(imap.fetchAll).toHaveBeenCalledWith(
      [22],
      expect.objectContaining({ threadId: true, labels: true, envelope: true, bodyStructure: true }),
      { uid: true }
    )
    expect(summaries[0]).toMatchObject({
      uid: 22,
      gmailMessageId: '1789000000000001',
      gmailThreadId: '1789000000000002',
      labels: ['\\Inbox', 'Work'],
      read: true,
      starred: true,
      hasAttachments: true
    })
    const body = await transport.fetchBody('INBOX', 22)
    expect(parseMime).toHaveBeenCalledWith(Buffer.from('raw message'))
    expect(body).toMatchObject({
      text: 'Plain body',
      html: '<p>HTML body</p>',
      references: ['<first@example.com>'],
      attachments: [{ filename: 'notes.txt', size: 5, content: Buffer.from('notes') }]
    })
    await transport.close()
  })

  it('maps Gmail search fields and performs every requested mutation by UID', async () => {
    const { dependencies, imap } = harness()
    const transport = await createGmailTransport({ auth }, dependencies)
    await transport.search('INBOX', {
      raw: 'has:attachment',
      read: false,
      starred: true,
      gmailMessageId: '123',
      gmailThreadId: '456',
      labels: ['Work'],
      withoutLabels: ['Later']
    })
    expect(imap.search).toHaveBeenLastCalledWith(
      {
        gmraw: 'has:attachment',
        seen: false,
        flagged: true,
        emailId: '123',
        threadId: '456',
        labels: { has: ['Work'], not: ['Later'] }
      },
      { uid: true }
    )
    await transport.archive('INBOX', 22)
    await transport.setRead('INBOX', [22, 23], true)
    await transport.setStarred('INBOX', 22, false)
    await transport.addLabels('INBOX', 22, ['Work'])
    await transport.removeLabels('INBOX', 22, ['Later'])
    await transport.setLabels('INBOX', 22, ['Work', 'Receipts'])
    await transport.trash('INBOX', 22)
    await transport.spam('INBOX', 23)
    expect(imap.messageFlagsRemove).toHaveBeenCalledWith(22, ['\\Inbox'], { uid: true, useLabels: true })
    expect(imap.messageFlagsAdd).toHaveBeenCalledWith([22, 23], ['\\Seen'], { uid: true })
    expect(imap.messageFlagsRemove).toHaveBeenCalledWith(22, ['\\Flagged'], { uid: true })
    expect(imap.messageFlagsAdd).toHaveBeenCalledWith(22, ['Work'], { uid: true, useLabels: true })
    expect(imap.messageFlagsSet).toHaveBeenCalledWith(22, ['Work', 'Receipts'], { uid: true, useLabels: true })
    expect(imap.messageMove).toHaveBeenCalledWith(22, '[Gmail]/Trash', { uid: true })
    expect(imap.messageMove).toHaveBeenCalledWith(23, '[Gmail]/Spam', { uid: true })
    await transport.close()
  })

  it('creates and subscribes to labels as IMAP mailboxes', async () => {
    const { dependencies, imap } = harness()
    const transport = await createGmailTransport({ auth }, dependencies)
    await expect(transport.createMailbox('Projects/Crew')).resolves.toEqual({
      path: 'Projects/Crew',
      created: true,
      mailboxId: 'box-1'
    })
    expect(imap.mailboxSubscribe).toHaveBeenCalledWith('Projects/Crew')
    await transport.close()
  })
})

describe('Gmail SMTP and drafts', () => {
  it('sends plain text, HTML, reply headers and attachments', async () => {
    const { dependencies, smtp } = harness()
    const transport = await createGmailTransport({ auth }, dependencies)
    const result = await transport.send({
      to: 'to@example.com',
      replyTo: 'reply@example.com',
      subject: 'Reply',
      text: 'Plain',
      html: '<p>HTML</p>',
      inReplyTo: '<parent@example.com>',
      references: ['<root@example.com>', '<parent@example.com>'],
      attachments: [{ filename: 'photo.png', content: Buffer.from('image'), contentType: 'image/png' }]
    })
    expect(smtp.sendMail).toHaveBeenCalledWith({
      from: auth.user,
      to: 'to@example.com',
      replyTo: 'reply@example.com',
      subject: 'Reply',
      text: 'Plain',
      html: '<p>HTML</p>',
      inReplyTo: '<parent@example.com>',
      references: ['<root@example.com>', '<parent@example.com>'],
      attachments: [{ filename: 'photo.png', content: Buffer.from('image'), contentType: 'image/png' }]
    })
    expect(result).toEqual({
      messageId: '<sent@example.com>',
      accepted: ['to@example.com'],
      rejected: [],
      pending: [],
      response: '250 accepted'
    })
    await transport.close()
  })

  it('appends and safely replaces Gmail drafts', async () => {
    const { dependencies, imap, composeMime } = harness()
    const transport = await createGmailTransport({ auth }, dependencies)
    const message = { to: 'to@example.com', subject: 'Draft', text: 'Body' }
    await expect(transport.appendDraft(message)).resolves.toEqual({
      mailbox: '[Gmail]/Drafts',
      uid: 30,
      uidValidity: '9'
    })
    await expect(transport.replaceDraft(22, message)).resolves.toEqual({
      mailbox: '[Gmail]/Drafts',
      uid: 30,
      uidValidity: '9'
    })
    expect(composeMime).toHaveBeenCalledWith({ from: auth.user, to: 'to@example.com', subject: 'Draft', text: 'Body' })
    expect(imap.append).toHaveBeenCalledWith('[Gmail]/Drafts', Buffer.from('composed mime'), ['\\Draft'], undefined)
    expect(imap.messageDelete).toHaveBeenCalledWith(22, { uid: true })
    expect(imap.append.mock.invocationCallOrder[1]).toBeLessThan(imap.messageDelete.mock.invocationCallOrder[0])
    await transport.close()
  })

  it('restores a watched mailbox after an IMAP reconnect', async () => {
    const first = fakeImap()
    const second = fakeImap()
    const { dependencies } = harness([first, second])
    const onDisconnect = vi.fn()
    const onReconnect = vi.fn()
    const transport = await createGmailTransport({ auth, reconnectDelayMs: 0, onDisconnect, onReconnect }, dependencies)
    await transport.watch('INBOX')
    first.usable = false
    first.emit('close')
    await vi.waitFor(() => expect(onReconnect).toHaveBeenCalledWith(1))
    expect(onDisconnect).toHaveBeenCalledOnce()
    expect(second.connect).toHaveBeenCalledOnce()
    expect(second.mailboxOpen).toHaveBeenCalledWith('INBOX')
    expect(transport.connected).toBe(true)
    await transport.close()
  })
})

describe('Gmail failure boundaries', () => {
  it('returns stable error codes without passing through transport details', async () => {
    const { dependencies, smtp } = harness()
    const transport = await createGmailTransport({ auth }, dependencies)
    smtp.sendMail.mockRejectedValueOnce(new Error(`authentication failed for ${auth.pass}`))
    const failure = transport.send({ to: 'to@example.com', subject: 'Failure' })
    await expect(failure).rejects.toBeInstanceOf(GmailTransportError)
    await expect(failure).rejects.toMatchObject({ code: 'SMTP_SEND_FAILED' })
    await expect(failure).rejects.not.toThrow(auth.pass)
    await transport.close()
  })
})
