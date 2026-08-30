import { afterEach, describe, expect, it } from 'vitest'
import { GmailTransport } from '../src/main/mail/gmail'
import { startGmailImapServer, type GmailLoopbackServer } from './helpers/gmail-imap-server'

let server: GmailLoopbackServer | null
let transport: GmailTransport | null

afterEach(async () => {
  if (transport) await transport.close().catch(() => {})
  if (server) await server.close()
  transport = null
  server = null
})

describe('mail credential secrecy', () => {
  it('keeps app passwords out of protocol histories and returned mail data', async () => {
    const password = 'secret app pass 1'
    server = await startGmailImapServer({
      id: 'private',
      email: 'private@gmail.com',
      password,
      messages: [
        {
          from: 'Ali <ali@example.com>',
          to: 'private@gmail.com',
          subject: 'Private note',
          text: 'Only the message belongs in this result.'
        }
      ]
    })
    transport = new GmailTransport({
      auth: { user: 'private@gmail.com', pass: password },
      imap: { host: '127.0.0.1', port: server.imapPort, secure: false, startTLS: false },
      smtp: { host: '127.0.0.1', port: server.smtpPort, secure: false, startTLS: false },
      connectionTimeoutMs: 2_000
    })
    await transport.connect()
    const mailboxes = await transport.listMailboxes()
    const messages = await transport.fetchSummaries('INBOX', { uids: [1] })
    await transport.send({ to: 'ali@example.com', subject: 'Reply', text: 'Safe' })

    const observable = JSON.stringify({
      mailboxes,
      messages,
      imapCommands: server.imapCommands,
      smtpCommands: server.smtpCommands,
      smtpMessages: server.smtpMessages
    })
    expect(observable).not.toContain(password)
    expect(observable).not.toContain(Buffer.from(`\0private@gmail.com\0${password}`).toString('base64'))
    expect(server.imapCommands.some(command => command.includes('[redacted]'))).toBe(true)
    expect(server.smtpCommands.some(command => command.includes('[redacted]'))).toBe(true)
  })
})
