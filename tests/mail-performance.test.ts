import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MailDatabase } from '../src/main/mail/database'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

let directory = ''
let database: MailDatabase

function namesOf(file: string, sql: string): string[] {
  const handle = new DatabaseSync(file)
  const rows = handle.prepare(sql).all() as Array<{ name: string }>
  handle.close()
  return rows.map(row => row.name)
}

function rowOf(file: string, sql: string): Record<string, unknown> {
  const handle = new DatabaseSync(file)
  const row = handle.prepare(sql).get() as Record<string, unknown>
  handle.close()
  return row
}

function plan(file: string, sql: string): string {
  const handle = new DatabaseSync(file)
  const rows = handle.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as Array<{ detail: string }>
  handle.close()
  return rows.map(row => row.detail).join(' | ')
}

function fill(count: number): void {
  database.upsertAccount({
    id: 'account',
    provider: 'gmail',
    email: 'crew@example.com',
    displayName: 'Crew',
    syncEnabled: true
  })
  database.upsertLabel('account', { id: 'inbox', name: 'Inbox', type: 'inbox' })
  for (let index = 0; index < count; index += 1) {
    database.writeMessage('account', {
      id: `message-${index}`,
      providerMessageId: `remote-${index}`,
      threadId: `thread-${index}`,
      subject: `Juniper ${index}`,
      bodyText: `body ${index}`,
      receivedAt: index,
      isRead: true,
      labelIds: ['inbox'],
      attachments: [
        {
          id: `file-${index}`,
          messageId: `message-${index}`,
          filename: 'notes.txt',
          mimeType: 'text/plain',
          size: 4,
          storageKey: `${index}`.padStart(32, '0')
        }
      ],
      participants: [
        { role: 'from', email: `sender${index}@example.com`, name: 'Sender', order: 0 },
        { role: 'to', email: 'crew@example.com', name: 'Crew', order: 0 }
      ]
    })
  }
}

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'crew-mail-'))
  database = new MailDatabase(directory)
})

afterEach(() => {
  database.close()
  rmSync(directory, { recursive: true, force: true })
})

describe('mail reads never scan the whole mailbox', () => {
  it('looks a message up by index rather than walking every participant and attachment', () => {
    fill(50)
    database.settle()
    const file = path.join(directory, 'mail.sqlite')
    expect(
      plan(file, 'SELECT * FROM participants WHERE account_id = ? AND message_id = ? ORDER BY sort_order, id')
    ).toContain('participants_message')
    expect(plan(file, 'SELECT * FROM attachments WHERE account_id = ? AND message_id = ? ORDER BY id')).toContain(
      'attachments_message'
    )
    const indexes = namesOf(file, "SELECT name FROM sqlite_master WHERE type = 'index'")
    expect(indexes).toContain('attachments_draft')
    expect(indexes).toContain('draft_recipients_draft')
  })

  it('takes the newest threads off an index instead of aggregating the account', () => {
    fill(50)
    database.settle()
    const plans = plan(
      path.join(directory, 'mail.sqlite'),
      'SELECT t.* FROM threads t WHERE t.account_id = ? ORDER BY t.latest_at DESC, t.id DESC LIMIT ?'
    )
    expect(plans).toContain('threads_latest')
    expect(plans).not.toContain('TEMP B-TREE')
  })

  it('reads one thread list without a query per message', () => {
    fill(60)
    const digests = database.listThreadDigests(
      'account',
      database.listThreads('account', 60).map(thread => thread.id)
    )
    expect(digests.size).toBe(60)
    const first = digests.get('thread-59')
    expect(first?.[0]?.participants).toHaveLength(2)
    expect(first?.[0]?.labels.map(label => label.id)).toEqual(['inbox'])
  })
})

describe('mail writes stay cheap as the mailbox grows', () => {
  it('replaces a message in the search index by rowid rather than scanning it', () => {
    fill(20)
    const file = path.join(directory, 'mail.sqlite')
    expect(plan(file, 'DELETE FROM messages_fts WHERE rowid = ?')).toContain('INDEX 0:=')
    expect(plan(file, "DELETE FROM messages_fts WHERE account_id = 'a' AND message_id = 'b'")).not.toContain(
      'INDEX 0:='
    )
    const trigger = String(rowOf(file, "SELECT sql FROM sqlite_master WHERE name = 'messages_fts_delete'").sql)
    expect(trigger).toContain('rowid = old.rowid')
    expect(database.listMessages('account', { search: 'Juniper' }).items).toHaveLength(20)
  })

  it('rebuilds the search index of a mailbox written before the change', () => {
    fill(20)
    const file = path.join(directory, 'mail.sqlite')
    const handle = new DatabaseSync(file)
    handle.exec('DELETE FROM messages_fts')
    handle.exec(
      "INSERT INTO messages_fts (account_id, message_id, subject, body_text, participant_text) SELECT account_id, id, subject, body_text, '' FROM messages"
    )
    handle.exec('PRAGMA user_version = 0')
    handle.close()
    database.close()
    database = new MailDatabase(directory)
    expect(database.listMessages('account', { search: 'Juniper' }).items).toHaveLength(20)
    expect(database.listMessages('account', { search: 'Sender' }).items).toHaveLength(20)
  })

  it('counts unread and finds an attachment without loading every message', () => {
    fill(30)
    database.writeMessage('account', {
      id: 'unread',
      providerMessageId: 'remote-unread',
      receivedAt: 99,
      isRead: false,
      attachments: [
        {
          id: 'file',
          messageId: 'unread',
          filename: 'notes.txt',
          mimeType: 'text/plain',
          size: 4,
          storageKey: '0123456789abcdef0123456789abcdef'
        }
      ]
    })
    expect(database.countUnread('account')).toBe(1)
    expect(database.getAttachment('account', 'file')?.filename).toBe('notes.txt')
    expect(database.findAttachment('file')?.accountId).toBe('account')
    expect(database.listAttachmentStorageKeys('account')).toContain('0123456789abcdef0123456789abcdef')
  })
})
