import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MailDatabase } from '../src/main/mail/database'

const directories: string[] = []

function stateDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'crew-mail-database-'))
  directories.push(directory)
  return directory
}

function account(database: MailDatabase, id: string, email = `${id}@example.com`): void {
  database.upsertAccount({ id, provider: 'gmail', email, displayName: id })
}

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
})

describe('mail database', () => {
  it('persists an account-scoped message graph and indexes its searchable text', () => {
    const directory = stateDirectory()
    let now = 100
    const database = new MailDatabase(directory, () => now++)
    account(database, 'first')
    database.upsertLabel('first', { id: 'inbox', providerId: 'INBOX', name: 'Inbox', type: 'inbox' })
    database.upsertThread('first', { id: 'thread-1', providerThreadId: 'remote-thread', subject: 'Dinner', latestAt: 80 })

    const written = database.upsertMessage('first', {
      id: 'message-1',
      providerMessageId: 'remote-message',
      threadId: 'thread-1',
      subject: 'Dinner plans',
      snippet: 'Meet at seven',
      bodyText: 'The reservation is at Juniper tonight.',
      bodyHtml: '<p>The reservation is at Juniper tonight.</p>',
      receivedAt: 80,
      sentAt: 70,
      isRead: false,
      isStarred: true,
      size: 240,
      labelIds: ['inbox'],
      participants: [
        { role: 'from', email: 'ada@example.com', name: 'Ada' },
        { role: 'to', email: 'first@example.com' }
      ],
      attachments: [
        { id: 'attachment-1', filename: 'menu.pdf', mimeType: 'application/pdf', size: 12, storageKey: 'a'.repeat(32) }
      ]
    })

    expect(written.inserted).toBe(true)
    expect(written.message).toMatchObject({
      id: 'message-1',
      providerMessageId: 'remote-message',
      threadId: 'thread-1',
      subject: 'Dinner plans',
      labels: [{ id: 'inbox' }],
      participants: [{ email: 'ada@example.com' }, { email: 'first@example.com' }],
      attachments: [{ id: 'attachment-1', filename: 'menu.pdf' }]
    })
    expect(database.listMessages('first', { search: 'Juniper' }).items.map(message => message.id)).toEqual(['message-1'])
    expect(database.listMessages('first', { search: 'Ada' }).items.map(message => message.id)).toEqual(['message-1'])
    expect(database.getThread('first', 'thread-1')).toMatchObject({ messageCount: 1, unreadCount: 1, latestAt: 80 })
    database.close()

    const reopened = new MailDatabase(directory)
    expect(reopened.getMessage('first', 'message-1')).toMatchObject({ bodyText: 'The reservation is at Juniper tonight.' })
    expect(fs.statSync(reopened.file).mode & 0o777).toBe(0o600)
    reopened.close()
  })

  it('deduplicates provider messages, updates FTS, and keeps the original local id', () => {
    const database = new MailDatabase(stateDirectory(), () => 10)
    account(database, 'first')
    database.upsertMessage('first', {
      id: 'local-one',
      providerMessageId: 'same-remote-id',
      receivedAt: 5,
      subject: 'Old words',
      bodyText: 'Before'
    })
    const updated = database.upsertMessage('first', {
      id: 'local-two',
      providerMessageId: 'same-remote-id',
      receivedAt: 6,
      subject: 'Fresh words',
      bodyText: 'After'
    })

    expect(updated.inserted).toBe(false)
    expect(updated.message.id).toBe('local-one')
    expect(database.listMessages('first').items).toHaveLength(1)
    expect(database.listMessages('first', { search: 'Fresh' }).items.map(message => message.id)).toEqual(['local-one'])
    expect(database.listMessages('first', { search: 'Old' }).items).toEqual([])
    database.close()
  })

  it('isolates accounts and binds pagination cursors to their account', () => {
    const database = new MailDatabase(stateDirectory(), () => 10)
    account(database, 'first')
    account(database, 'second')
    for (let index = 1; index <= 3; index++) {
      database.upsertMessage('first', { id: `first-${index}`, providerMessageId: `first-${index}`, receivedAt: index })
      database.upsertMessage('second', { id: `second-${index}`, providerMessageId: `second-${index}`, receivedAt: index })
    }

    const firstPage = database.listMessages('first', { limit: 2 })
    expect(firstPage.items.map(message => message.id)).toEqual(['first-3', 'first-2'])
    expect(firstPage.nextCursor).toEqual(expect.any(String))
    expect(database.listMessages('first', { limit: 2, cursor: firstPage.nextCursor }).items.map(message => message.id)).toEqual(['first-1'])
    expect(() => database.listMessages('second', { cursor: firstPage.nextCursor })).toThrow('Mail page cursor is invalid')
    expect(database.listMessages('second').items.every(message => message.accountId === 'second')).toBe(true)
    database.close()
  })

  it('stores drafts, attachments, scheduled sends, snoozes, and sync cursors', () => {
    let now = 10
    const database = new MailDatabase(stateDirectory(), () => now++)
    account(database, 'first')
    database.upsertThread('first', { id: 'thread', latestAt: 5 })
    database.upsertMessage('first', { id: 'message', providerMessageId: 'remote', threadId: 'thread', receivedAt: 5 })
    const draft = database.upsertDraft('first', {
      id: 'draft',
      subject: 'A note',
      bodyText: 'Hello',
      recipients: [{ role: 'to', email: 'reader@example.com' }],
      attachments: [{ id: 'draft-file', filename: 'note.txt', size: 4 }]
    })

    expect(draft).toMatchObject({
      id: 'draft',
      recipients: [{ email: 'reader@example.com' }],
      attachments: [{ id: 'draft-file', draftId: 'draft' }]
    })
    const scheduled = database.scheduleSend('first', 'draft', 40, 'schedule')
    expect(database.listDueScheduledSends(39)).toEqual([])
    expect(database.listDueScheduledSends(40)).toEqual([scheduled])
    expect(database.updateScheduledSend('first', 'schedule', 'failed', { incrementAttempt: true, lastError: 'Offline' })).toMatchObject({
      status: 'failed', attemptCount: 1, lastError: 'Offline'
    })
    const snooze = database.snoozeThread('first', 'thread', 30, 'snooze')
    expect(database.listDueSnoozes(29)).toEqual([])
    expect(database.listDueSnoozes(30)).toEqual([snooze])
    database.setCursor('first', 'inbox', 'opaque-server-cursor')
    expect(database.getCursor('first', 'inbox')).toBe('opaque-server-cursor')
    expect(database.deleteAccount('first')).toBe(true)
    expect(database.listDueScheduledSends(100)).toEqual([])
    expect(database.listDueSnoozes(100)).toEqual([])
    database.close()
  })

  it('validates inputs before changing storage', () => {
    const database = new MailDatabase(stateDirectory(), () => 10)
    account(database, 'first')
    expect(() => database.upsertAccount({ id: 'bad', provider: 'gmail', email: 'not-an-email' })).toThrow(TypeError)
    expect(() => database.upsertMessage('first', { id: '', providerMessageId: 'remote', receivedAt: 1 })).toThrow(TypeError)
    expect(() => database.upsertMessage('missing', { id: 'id', providerMessageId: 'remote', receivedAt: 1 })).toThrow('Mail account was not found')
    expect(() => database.upsertAttachment('first', { id: 'file', messageId: 'message', filename: 'file', size: 1, storageKey: '../outside' })).toThrow(TypeError)
    expect(database.listMessages('first').items).toEqual([])
    database.close()
  })

  it('persists signatures and migrates account databases created before signatures', async () => {
    const directory = stateDirectory()
    const file = path.join(directory, 'mail.sqlite')
    const { createRequire } = await import('node:module')
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
    const legacy = new DatabaseSync(file)
    legacy.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        sync_enabled INTEGER NOT NULL,
        last_synced_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(provider, email)
      ) STRICT;
      INSERT INTO accounts VALUES ('first', 'gmail', 'first@example.com', 'First', 1, NULL, 1, 1);
    `)
    legacy.close()

    const database = new MailDatabase(directory, () => 20)
    expect(database.getAccount('first')).toMatchObject({ signature: '' })
    database.upsertAccount({ id: 'first', provider: 'gmail', email: 'first@example.com', signature: 'Kind regards' })
    expect(database.getAccount('first')).toMatchObject({ displayName: 'First', signature: 'Kind regards' })
    database.upsertAccount({ id: 'first', provider: 'gmail', email: 'first@example.com', displayName: 'One' })
    expect(database.getAccount('first')).toMatchObject({ displayName: 'One', signature: 'Kind regards' })
    database.close()
  })
})
