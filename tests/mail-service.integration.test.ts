import { afterEach, describe, expect, it } from 'vitest'
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { simpleParser } from 'mailparser'
import { startGmailImapServer, type GmailLoopbackServer } from './helpers/gmail-imap-server'

const openServers: GmailLoopbackServer[] = []
const openClients: ImapFlow[] = []

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
  for (const client of openClients.splice(0)) {
    if (client.usable) await client.logout().catch(() => {})
  }
  for (const server of openServers.splice(0)) await server.close()
})

describe('the Gmail loopback fixture', () => {
  it('keeps two accounts separate while both are read into one view', async () => {
    const server = await fixture()
    const personal = await connect(server, 'personal')
    const work = await connect(server, 'work')

    await personal.mailboxOpen('INBOX')
    await work.mailboxOpen('INBOX')
    const personalMail = await personal.fetchAll('1:*', { uid: true, envelope: true, flags: true, labels: true, source: true })
    const workMail = await work.fetchAll('1:*', { uid: true, envelope: true, flags: true, labels: true, source: true })

    expect(personalMail.map(one => one.envelope?.subject)).toEqual(['Dinner this weekend', 'Crew receipt'])
    expect(workMail.map(one => one.envelope?.subject)).toEqual(['Release checklist'])
    expect([...personalMail[0].labels!]).toContain('INBOX')
    expect(personalMail[0].emailId).toMatch(/^\d+$/)
    expect(personalMail[0].threadId).toMatch(/^\d+$/)
    expect((await simpleParser(personalMail[0].source!)).html).toContain('Dinner this weekend')
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
