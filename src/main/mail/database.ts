import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import type { DatabaseSync as Database, SQLInputValue } from 'node:sqlite'
import {
  MAIL_LABEL_TYPES,
  MAIL_PARTICIPANT_ROLES,
  MAIL_PROVIDERS,
  MAIL_SCHEDULE_STATUSES,
  mailPageLimit,
  parseMailAccountInput,
  parseMailAttachmentInput,
  parseMailDraftInput,
  parseMailLabelInput,
  parseMailMessageInput,
  parseMailParticipantInput,
  parseMailThreadInput,
  type MailAccount,
  type MailAccountInput,
  type MailAttachment,
  type MailAttachmentInput,
  type MailDraft,
  type MailDraftInput,
  type MailLabel,
  type MailLabelInput,
  type MailMessage,
  type MailMessageInput,
  type MailMessageQuery,
  type MailPage,
  type MailParticipant,
  type MailParticipantInput,
  type MailScheduledSend,
  type MailScheduleStatus,
  type MailSnooze,
  type MailThread,
  type MailThreadInput
} from '../../shared/mail'

type Row = Record<string, string | number | bigint | null>

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

interface PageCursor {
  accountId: string
  receivedAt: number
  id: string
}

export interface MailMessageWriteResult {
  message: MailMessage
  inserted: boolean
}

const DIRECTORY_MODE = 0o700
const FILE_MODE = 0o600

function requiredId(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} cannot be empty`)
  return value.trim()
}

function time(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative number`)
  return value
}

function count(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`)
  return value
}

function boolean(value: string | number | bigint | null): boolean {
  return Number(value) === 1
}

function number(value: string | number | bigint | null): number {
  return Number(value)
}

function nullableNumber(value: string | number | bigint | null): number | null {
  return value === null ? null : Number(value)
}

function nullableString(value: string | number | bigint | null): string | null {
  return value === null ? null : String(value)
}

function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

function decodeCursor(value: string | null | undefined, accountId: string): PageCursor | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error()
    const cursor = parsed as Record<string, unknown>
    if (cursor.accountId !== accountId || typeof cursor.id !== 'string' || !cursor.id) throw new Error()
    return { accountId, id: cursor.id, receivedAt: time(cursor.receivedAt, 'Mail cursor time') }
  } catch {
    throw new TypeError('Mail page cursor is invalid')
  }
}

export class MailDatabase {
  readonly file: string
  private readonly database: Database

  constructor(stateDirectory: string, private readonly clock: () => number = Date.now) {
    const directory = path.resolve(stateDirectory)
    fs.mkdirSync(directory, { recursive: true, mode: DIRECTORY_MODE })
    fs.chmodSync(directory, DIRECTORY_MODE)
    this.file = path.join(directory, 'mail.sqlite')
    this.database = new DatabaseSync(this.file)
    fs.chmodSync(this.file, FILE_MODE)
    this.database.exec('PRAGMA foreign_keys = ON')
    this.database.exec('PRAGMA journal_mode = WAL')
    this.database.exec('PRAGMA synchronous = NORMAL')
    this.migrate()
  }

  close(): void {
    this.database.close()
  }

  upsertAccount(value: MailAccountInput): MailAccount {
    const input = parseMailAccountInput(value)
    const existing = this.getAccount(input.id)
    const now = this.clock()
    this.database.prepare(`
      INSERT INTO accounts (id, provider, email, display_name, signature, sync_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        provider = excluded.provider,
        email = excluded.email,
        display_name = excluded.display_name,
        signature = excluded.signature,
        sync_enabled = excluded.sync_enabled,
        updated_at = excluded.updated_at
    `).run(
      input.id,
      input.provider,
      input.email,
      input.displayName ?? existing?.displayName ?? '',
      input.signature ?? existing?.signature ?? '',
      input.syncEnabled === undefined ? (existing?.syncEnabled === false ? 0 : 1) : (input.syncEnabled ? 1 : 0),
      now,
      now
    )
    return this.getAccount(input.id) as MailAccount
  }

  getAccount(accountId: string): MailAccount | null {
    const row = this.database.prepare('SELECT * FROM accounts WHERE id = ?').get(requiredId(accountId, 'Mail account id')) as Row | undefined
    return row ? this.account(row) : null
  }

  listAccounts(): MailAccount[] {
    return (this.database.prepare('SELECT * FROM accounts ORDER BY email, id').all() as Row[]).map(row => this.account(row))
  }

  deleteAccount(accountId: string): boolean {
    return this.database.prepare('DELETE FROM accounts WHERE id = ?').run(requiredId(accountId, 'Mail account id')).changes > 0
  }

  setAccountLastSyncedAt(accountId: string, syncedAt: number | null): MailAccount {
    const id = requiredId(accountId, 'Mail account id')
    const now = this.clock()
    const result = this.database.prepare('UPDATE accounts SET last_synced_at = ?, updated_at = ? WHERE id = ?').run(
      syncedAt === null ? null : time(syncedAt, 'Mail account sync time'), now, id
    )
    if (!result.changes) throw new Error('Mail account was not found')
    return this.getAccount(id) as MailAccount
  }

  upsertLabel(accountId: string, value: MailLabelInput): MailLabel {
    const account = this.accountId(accountId)
    const input = parseMailLabelInput(value)
    const now = this.clock()
    this.database.prepare(`
      INSERT INTO labels (account_id, id, provider_id, name, type, color, unread_count, total_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, id) DO UPDATE SET
        provider_id = excluded.provider_id,
        name = excluded.name,
        type = excluded.type,
        color = excluded.color,
        unread_count = excluded.unread_count,
        total_count = excluded.total_count,
        updated_at = excluded.updated_at
    `).run(account, input.id, input.providerId ?? null, input.name, input.type ?? 'user', input.color ?? null, input.unreadCount ?? 0, input.totalCount ?? 0, now, now)
    return this.label(this.database.prepare('SELECT * FROM labels WHERE account_id = ? AND id = ?').get(account, input.id) as Row)
  }

  listLabels(accountId: string): MailLabel[] {
    const account = this.accountId(accountId)
    return (this.database.prepare('SELECT * FROM labels WHERE account_id = ? ORDER BY type, name, id').all(account) as Row[]).map(row => this.label(row))
  }

  deleteLabel(accountId: string, labelId: string): boolean {
    return this.database.prepare('DELETE FROM labels WHERE account_id = ? AND id = ?').run(this.accountId(accountId), requiredId(labelId, 'Mail label id')).changes > 0
  }

  upsertThread(accountId: string, value: MailThreadInput): MailThread {
    const account = this.accountId(accountId)
    const input = parseMailThreadInput(value)
    const now = this.clock()
    this.database.prepare(`
      INSERT INTO threads (account_id, id, provider_thread_id, subject, snippet, latest_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, id) DO UPDATE SET
        provider_thread_id = excluded.provider_thread_id,
        subject = excluded.subject,
        snippet = excluded.snippet,
        latest_at = excluded.latest_at,
        updated_at = excluded.updated_at
    `).run(account, input.id, input.providerThreadId ?? null, input.subject ?? '', input.snippet ?? '', input.latestAt, now, now)
    return this.getThread(account, input.id) as MailThread
  }

  getThread(accountId: string, threadId: string): MailThread | null {
    const account = this.accountId(accountId)
    const row = this.database.prepare(`
      SELECT t.*,
        COUNT(tm.message_id) AS message_count,
        COALESCE(SUM(CASE WHEN m.is_read = 0 THEN 1 ELSE 0 END), 0) AS unread_count
      FROM threads t
      LEFT JOIN thread_messages tm ON tm.account_id = t.account_id AND tm.thread_id = t.id
      LEFT JOIN messages m ON m.account_id = tm.account_id AND m.id = tm.message_id
      WHERE t.account_id = ? AND t.id = ?
      GROUP BY t.account_id, t.id
    `).get(account, requiredId(threadId, 'Mail thread id')) as Row | undefined
    return row ? this.thread(row) : null
  }

  listThreads(accountId: string, limit = 100): MailThread[] {
    const account = this.accountId(accountId)
    const size = Math.min(count(limit, 'Mail thread limit'), 200)
    return (this.database.prepare(`
      SELECT t.*,
        COUNT(tm.message_id) AS message_count,
        COALESCE(SUM(CASE WHEN m.is_read = 0 THEN 1 ELSE 0 END), 0) AS unread_count
      FROM threads t
      LEFT JOIN thread_messages tm ON tm.account_id = t.account_id AND tm.thread_id = t.id
      LEFT JOIN messages m ON m.account_id = tm.account_id AND m.id = tm.message_id
      WHERE t.account_id = ?
      GROUP BY t.account_id, t.id
      ORDER BY t.latest_at DESC, t.id DESC
      LIMIT ?
    `).all(account, size) as Row[]).map(row => this.thread(row))
  }

  upsertMessage(accountId: string, value: MailMessageInput): MailMessageWriteResult {
    const account = this.accountId(accountId)
    const input = parseMailMessageInput(value)
    const existing = this.database.prepare('SELECT id FROM messages WHERE account_id = ? AND provider_message_id = ?').get(account, input.providerMessageId) as Row | undefined
    const id = existing ? String(existing.id) : input.id
    const now = this.clock()
    return this.transaction(() => {
      if (input.threadId) {
        this.database.prepare(`
          INSERT INTO threads (account_id, id, provider_thread_id, subject, snippet, latest_at, created_at, updated_at)
          VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
          ON CONFLICT(account_id, id) DO UPDATE SET
            subject = CASE WHEN excluded.subject = '' THEN threads.subject ELSE excluded.subject END,
            snippet = CASE WHEN excluded.snippet = '' THEN threads.snippet ELSE excluded.snippet END,
            latest_at = MAX(threads.latest_at, excluded.latest_at),
            updated_at = excluded.updated_at
        `).run(account, input.threadId, input.subject ?? '', input.snippet ?? '', input.receivedAt, now, now)
      }
      this.database.prepare(`
        INSERT INTO messages (
          account_id, id, provider_message_id, message_id_header, in_reply_to, subject, snippet,
          body_text, body_html, sent_at, received_at, is_read, is_starred, is_draft, is_sent,
          is_trashed, size, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, provider_message_id) DO UPDATE SET
          message_id_header = excluded.message_id_header,
          in_reply_to = excluded.in_reply_to,
          subject = excluded.subject,
          snippet = excluded.snippet,
          body_text = excluded.body_text,
          body_html = excluded.body_html,
          sent_at = excluded.sent_at,
          received_at = excluded.received_at,
          is_read = excluded.is_read,
          is_starred = excluded.is_starred,
          is_draft = excluded.is_draft,
          is_sent = excluded.is_sent,
          is_trashed = excluded.is_trashed,
          size = excluded.size,
          updated_at = excluded.updated_at
      `).run(
        account, id, input.providerMessageId, input.messageIdHeader ?? null, input.inReplyTo ?? null,
        input.subject ?? '', input.snippet ?? '', input.bodyText ?? '', input.bodyHtml ?? null,
        input.sentAt ?? null, input.receivedAt, input.isRead ? 1 : 0, input.isStarred ? 1 : 0,
        input.isDraft ? 1 : 0, input.isSent ? 1 : 0, input.isTrashed ? 1 : 0, input.size ?? 0, now, now
      )
      if (input.threadId !== undefined) {
        this.database.prepare('DELETE FROM thread_messages WHERE account_id = ? AND message_id = ?').run(account, id)
        if (input.threadId) this.database.prepare('INSERT INTO thread_messages (account_id, thread_id, message_id) VALUES (?, ?, ?)').run(account, input.threadId, id)
      }
      if (input.labelIds !== undefined) this.setMessageLabels(account, id, input.labelIds)
      if (input.participants !== undefined) this.setParticipants(account, id, input.participants)
      if (input.attachments !== undefined) this.setMessageAttachments(account, id, input.attachments)
      this.indexMessage(account, id)
      return { message: this.getMessage(account, id) as MailMessage, inserted: !existing }
    })
  }

  getMessage(accountId: string, messageId: string): MailMessage | null {
    const account = this.accountId(accountId)
    const id = requiredId(messageId, 'Mail message id')
    const row = this.database.prepare(`
      SELECT m.*, tm.thread_id
      FROM messages m
      LEFT JOIN thread_messages tm ON tm.account_id = m.account_id AND tm.message_id = m.id
      WHERE m.account_id = ? AND m.id = ?
    `).get(account, id) as Row | undefined
    return row ? this.message(row) : null
  }

  getMessageByProviderId(accountId: string, providerMessageId: string): MailMessage | null {
    const account = this.accountId(accountId)
    const row = this.database.prepare(`
      SELECT m.*, tm.thread_id
      FROM messages m
      LEFT JOIN thread_messages tm ON tm.account_id = m.account_id AND tm.message_id = m.id
      WHERE m.account_id = ? AND m.provider_message_id = ?
    `).get(account, requiredId(providerMessageId, 'Mail provider message id')) as Row | undefined
    return row ? this.message(row) : null
  }

  listMessages(accountId: string, query: MailMessageQuery = {}): MailPage<MailMessage> {
    const account = this.accountId(accountId)
    const limit = mailPageLimit(query.limit)
    const cursor = decodeCursor(query.cursor, account)
    const clauses = ['m.account_id = ?']
    const values: SQLInputValue[] = [account]
    let joins = 'LEFT JOIN thread_messages tm ON tm.account_id = m.account_id AND tm.message_id = m.id'
    if (query.labelId !== undefined) {
      joins += ' JOIN message_labels ml ON ml.account_id = m.account_id AND ml.message_id = m.id'
      clauses.push('ml.label_id = ?')
      values.push(requiredId(query.labelId, 'Mail label id'))
    }
    if (query.threadId !== undefined) {
      clauses.push('tm.thread_id = ?')
      values.push(requiredId(query.threadId, 'Mail thread id'))
    }
    if (query.unread !== undefined) {
      if (typeof query.unread !== 'boolean') throw new TypeError('Mail unread filter must be a boolean')
      clauses.push('m.is_read = ?')
      values.push(query.unread ? 0 : 1)
    }
    if (query.search !== undefined) {
      const search = requiredId(query.search, 'Mail search')
      joins += ' JOIN messages_fts f ON f.account_id = m.account_id AND f.message_id = m.id'
      clauses.push('messages_fts MATCH ?')
      values.push(search)
    }
    if (cursor) {
      clauses.push('(m.received_at < ? OR (m.received_at = ? AND m.id < ?))')
      values.push(cursor.receivedAt, cursor.receivedAt, cursor.id)
    }
    const rows = this.database.prepare(`
      SELECT m.*, tm.thread_id
      FROM messages m
      ${joins}
      WHERE ${clauses.join(' AND ')}
      ORDER BY m.received_at DESC, m.id DESC
      LIMIT ?
    `).all(...values, limit + 1) as Row[]
    const more = rows.length > limit
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    return {
      items: page.map(row => this.message(row)),
      nextCursor: more && last ? encodeCursor({ accountId: account, receivedAt: number(last.received_at), id: String(last.id) }) : null
    }
  }

  deleteMessage(accountId: string, messageId: string): boolean {
    return this.database.prepare('DELETE FROM messages WHERE account_id = ? AND id = ?').run(this.accountId(accountId), requiredId(messageId, 'Mail message id')).changes > 0
  }

  setMessageLabels(accountId: string, messageId: string, labelIds: string[]): void {
    const account = this.accountId(accountId)
    const message = requiredId(messageId, 'Mail message id')
    if (!Array.isArray(labelIds)) throw new TypeError('Mail message labels must be an array')
    const ids = [...new Set(labelIds.map(value => requiredId(value, 'Mail label id')))]
    this.database.prepare('DELETE FROM message_labels WHERE account_id = ? AND message_id = ?').run(account, message)
    const insert = this.database.prepare('INSERT INTO message_labels (account_id, message_id, label_id) VALUES (?, ?, ?)')
    for (const id of ids) insert.run(account, message, id)
  }

  setParticipants(accountId: string, messageId: string, values: MailParticipantInput[]): void {
    const account = this.accountId(accountId)
    const message = requiredId(messageId, 'Mail message id')
    if (!Array.isArray(values)) throw new TypeError('Mail participants must be an array')
    const participants = values.map(parseMailParticipantInput)
    this.database.prepare('DELETE FROM participants WHERE account_id = ? AND message_id = ?').run(account, message)
    const insert = this.database.prepare(`
      INSERT INTO participants (account_id, id, message_id, role, email, name, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    participants.forEach((participant, index) => insert.run(
      account, participant.id ?? randomUUID(), message, participant.role, participant.email,
      participant.name ?? null, participant.order ?? index
    ))
    this.indexMessage(account, message)
  }

  setMessageAttachments(accountId: string, messageId: string, values: MailAttachmentInput[]): void {
    const account = this.accountId(accountId)
    const message = requiredId(messageId, 'Mail message id')
    if (!Array.isArray(values)) throw new TypeError('Mail attachments must be an array')
    this.database.prepare('DELETE FROM attachments WHERE account_id = ? AND message_id = ?').run(account, message)
    for (const value of values) this.upsertAttachment(account, { ...parseMailAttachmentInput(value), messageId: message, draftId: null })
  }

  upsertAttachment(accountId: string, value: MailAttachmentInput): MailAttachment {
    const account = this.accountId(accountId)
    const input = parseMailAttachmentInput(value)
    const messageId = input.messageId ?? null
    const draftId = input.draftId ?? null
    if ((messageId === null) === (draftId === null)) throw new TypeError('Mail attachment must belong to one message or draft')
    const now = this.clock()
    this.database.prepare(`
      INSERT INTO attachments (
        account_id, id, message_id, draft_id, filename, mime_type, size, content_id,
        is_inline, storage_key, checksum, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, id) DO UPDATE SET
        message_id = excluded.message_id,
        draft_id = excluded.draft_id,
        filename = excluded.filename,
        mime_type = excluded.mime_type,
        size = excluded.size,
        content_id = excluded.content_id,
        is_inline = excluded.is_inline,
        storage_key = excluded.storage_key,
        checksum = excluded.checksum
    `).run(
      account, input.id, messageId, draftId, input.filename, input.mimeType ?? 'application/octet-stream',
      input.size, input.contentId ?? null, input.inline ? 1 : 0, input.storageKey ?? null, input.checksum ?? null, now
    )
    return this.attachment(this.database.prepare('SELECT * FROM attachments WHERE account_id = ? AND id = ?').get(account, input.id) as Row)
  }

  getAttachment(accountId: string, attachmentId: string): MailAttachment | null {
    const row = this.database.prepare('SELECT * FROM attachments WHERE account_id = ? AND id = ?').get(
      this.accountId(accountId),
      requiredId(attachmentId, 'Mail attachment id')
    ) as Row | undefined
    return row ? this.attachment(row) : null
  }

  findAttachment(attachmentId: string): MailAttachment | null {
    const row = this.database.prepare('SELECT * FROM attachments WHERE id = ? ORDER BY account_id LIMIT 1').get(
      requiredId(attachmentId, 'Mail attachment id')
    ) as Row | undefined
    return row ? this.attachment(row) : null
  }

  listAttachmentStorageKeys(accountId: string): string[] {
    return (this.database.prepare(
      'SELECT DISTINCT storage_key FROM attachments WHERE account_id = ? AND storage_key IS NOT NULL'
    ).all(this.accountId(accountId)) as Row[]).map(row => String(row.storage_key))
  }

  upsertDraft(accountId: string, value: MailDraftInput): MailDraft {
    const account = this.accountId(accountId)
    const input = parseMailDraftInput(value)
    const now = this.clock()
    return this.transaction(() => {
      this.database.prepare(`
        INSERT INTO drafts (
          account_id, id, provider_draft_id, reply_to_message_id, subject, body_text, body_html,
          version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, id) DO UPDATE SET
          provider_draft_id = excluded.provider_draft_id,
          reply_to_message_id = excluded.reply_to_message_id,
          subject = excluded.subject,
          body_text = excluded.body_text,
          body_html = excluded.body_html,
          version = excluded.version,
          updated_at = excluded.updated_at
      `).run(
        account, input.id, input.providerDraftId ?? null, input.replyToMessageId ?? null,
        input.subject ?? '', input.bodyText ?? '', input.bodyHtml ?? null, input.version ?? 1, now, now
      )
      if (input.recipients !== undefined) this.setDraftRecipients(account, input.id, input.recipients)
      if (input.attachments !== undefined) {
        this.database.prepare('DELETE FROM attachments WHERE account_id = ? AND draft_id = ?').run(account, input.id)
        for (const attachment of input.attachments) {
          this.upsertAttachment(account, { ...attachment, messageId: null, draftId: input.id })
        }
      }
      return this.getDraft(account, input.id) as MailDraft
    })
  }

  getDraft(accountId: string, draftId: string): MailDraft | null {
    const account = this.accountId(accountId)
    const row = this.database.prepare('SELECT * FROM drafts WHERE account_id = ? AND id = ?').get(account, requiredId(draftId, 'Mail draft id')) as Row | undefined
    return row ? this.draft(row) : null
  }

  listDrafts(accountId: string): MailDraft[] {
    const account = this.accountId(accountId)
    return (this.database.prepare('SELECT * FROM drafts WHERE account_id = ? ORDER BY updated_at DESC, id DESC').all(account) as Row[]).map(row => this.draft(row))
  }

  deleteDraft(accountId: string, draftId: string): boolean {
    return this.database.prepare('DELETE FROM drafts WHERE account_id = ? AND id = ?').run(this.accountId(accountId), requiredId(draftId, 'Mail draft id')).changes > 0
  }

  scheduleSend(accountId: string, draftId: string, sendAt: number, id: string = randomUUID()): MailScheduledSend {
    const account = this.accountId(accountId)
    const draft = requiredId(draftId, 'Mail draft id')
    const scheduleId = requiredId(id, 'Mail scheduled send id')
    const scheduledAt = time(sendAt, 'Mail scheduled send time')
    const now = this.clock()
    this.database.prepare(`
      INSERT INTO scheduled_sends (
        account_id, id, draft_id, send_at, status, attempt_count, last_error,
        provider_request_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', 0, NULL, NULL, ?, ?)
      ON CONFLICT(account_id, draft_id) DO UPDATE SET
        id = excluded.id,
        send_at = excluded.send_at,
        status = 'pending',
        attempt_count = 0,
        last_error = NULL,
        provider_request_id = NULL,
        updated_at = excluded.updated_at
    `).run(account, scheduleId, draft, scheduledAt, now, now)
    return this.getScheduledSend(account, scheduleId) ?? this.getScheduledSendForDraft(account, draft) as MailScheduledSend
  }

  updateScheduledSend(
    accountId: string,
    id: string,
    status: MailScheduleStatus,
    options: { lastError?: string | null; providerRequestId?: string | null; incrementAttempt?: boolean } = {}
  ): MailScheduledSend {
    const account = this.accountId(accountId)
    const scheduleId = requiredId(id, 'Mail scheduled send id')
    if (!MAIL_SCHEDULE_STATUSES.includes(status)) throw new TypeError('Mail scheduled send status is not supported')
    const now = this.clock()
    const result = this.database.prepare(`
      UPDATE scheduled_sends SET
        status = ?,
        attempt_count = attempt_count + ?,
        last_error = ?,
        provider_request_id = ?,
        updated_at = ?
      WHERE account_id = ? AND id = ?
    `).run(
      status, options.incrementAttempt ? 1 : 0, options.lastError ?? null,
      options.providerRequestId ?? null, now, account, scheduleId
    )
    if (!result.changes) throw new Error('Mail scheduled send was not found')
    return this.getScheduledSend(account, scheduleId) as MailScheduledSend
  }

  listDueScheduledSends(now: number, limit = 100): MailScheduledSend[] {
    const due = time(now, 'Mail scheduled send due time')
    const size = Math.min(count(limit, 'Mail scheduled send limit'), 200)
    return (this.database.prepare(`
      SELECT * FROM scheduled_sends
      WHERE status = 'pending' AND send_at <= ?
      ORDER BY send_at, account_id, id
      LIMIT ?
    `).all(due, size) as Row[]).map(row => this.scheduledSend(row))
  }

  getScheduledSend(accountId: string, id: string): MailScheduledSend | null {
    const row = this.database.prepare('SELECT * FROM scheduled_sends WHERE account_id = ? AND id = ?').get(
      this.accountId(accountId), requiredId(id, 'Mail scheduled send id')
    ) as Row | undefined
    return row ? this.scheduledSend(row) : null
  }

  snoozeThread(accountId: string, threadId: string, wakeAt: number, id: string = randomUUID()): MailSnooze {
    return this.putSnooze(this.accountId(accountId), requiredId(id, 'Mail snooze id'), requiredId(threadId, 'Mail thread id'), null, wakeAt)
  }

  snoozeMessage(accountId: string, messageId: string, wakeAt: number, id: string = randomUUID()): MailSnooze {
    return this.putSnooze(this.accountId(accountId), requiredId(id, 'Mail snooze id'), null, requiredId(messageId, 'Mail message id'), wakeAt)
  }

  listDueSnoozes(now: number, limit = 100): MailSnooze[] {
    const due = time(now, 'Mail snooze due time')
    const size = Math.min(count(limit, 'Mail snooze limit'), 200)
    return (this.database.prepare('SELECT * FROM snoozes WHERE wake_at <= ? ORDER BY wake_at, account_id, id LIMIT ?').all(due, size) as Row[]).map(row => this.snooze(row))
  }

  deleteSnooze(accountId: string, id: string): boolean {
    return this.database.prepare('DELETE FROM snoozes WHERE account_id = ? AND id = ?').run(this.accountId(accountId), requiredId(id, 'Mail snooze id')).changes > 0
  }

  setCursor(accountId: string, resource: string, cursor: string): void {
    const account = this.accountId(accountId)
    const key = requiredId(resource, 'Mail cursor resource')
    const value = requiredId(cursor, 'Mail cursor value')
    this.database.prepare(`
      INSERT INTO sync_cursors (account_id, resource, cursor, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id, resource) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at
    `).run(account, key, value, this.clock())
  }

  getCursor(accountId: string, resource: string): string | null {
    const row = this.database.prepare('SELECT cursor FROM sync_cursors WHERE account_id = ? AND resource = ?').get(
      this.accountId(accountId), requiredId(resource, 'Mail cursor resource')
    ) as Row | undefined
    return row ? String(row.cursor) : null
  }

  private getScheduledSendForDraft(accountId: string, draftId: string): MailScheduledSend | null {
    const row = this.database.prepare('SELECT * FROM scheduled_sends WHERE account_id = ? AND draft_id = ?').get(accountId, draftId) as Row | undefined
    return row ? this.scheduledSend(row) : null
  }

  private putSnooze(accountId: string, id: string, threadId: string | null, messageId: string | null, wakeAt: number): MailSnooze {
    const now = this.clock()
    this.database.prepare(`
      INSERT INTO snoozes (account_id, id, thread_id, message_id, wake_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id, id) DO UPDATE SET
        thread_id = excluded.thread_id,
        message_id = excluded.message_id,
        wake_at = excluded.wake_at
    `).run(accountId, id, threadId, messageId, time(wakeAt, 'Mail snooze wake time'), now)
    return this.snooze(this.database.prepare('SELECT * FROM snoozes WHERE account_id = ? AND id = ?').get(accountId, id) as Row)
  }

  private setDraftRecipients(accountId: string, draftId: string, values: MailParticipantInput[]): void {
    const recipients = values.map(parseMailParticipantInput)
    this.database.prepare('DELETE FROM draft_recipients WHERE account_id = ? AND draft_id = ?').run(accountId, draftId)
    const insert = this.database.prepare(`
      INSERT INTO draft_recipients (account_id, id, draft_id, role, email, name, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    recipients.forEach((recipient, index) => insert.run(
      accountId, recipient.id ?? randomUUID(), draftId, recipient.role, recipient.email,
      recipient.name ?? null, recipient.order ?? index
    ))
  }

  private indexMessage(accountId: string, messageId: string): void {
    const row = this.database.prepare(`
      SELECT m.subject, m.body_text, COALESCE(GROUP_CONCAT(COALESCE(p.name, '') || ' ' || p.email, ' '), '') AS participant_text
      FROM messages m
      LEFT JOIN participants p ON p.account_id = m.account_id AND p.message_id = m.id
      WHERE m.account_id = ? AND m.id = ?
      GROUP BY m.account_id, m.id
    `).get(accountId, messageId) as Row | undefined
    this.database.prepare('DELETE FROM messages_fts WHERE account_id = ? AND message_id = ?').run(accountId, messageId)
    if (row) this.database.prepare('INSERT INTO messages_fts (account_id, message_id, subject, body_text, participant_text) VALUES (?, ?, ?, ?, ?)').run(
      accountId, messageId, String(row.subject), String(row.body_text), String(row.participant_text)
    )
  }

  private accountId(value: string): string {
    const id = requiredId(value, 'Mail account id')
    if (!this.database.prepare('SELECT 1 FROM accounts WHERE id = ?').get(id)) throw new Error('Mail account was not found')
    return id
  }

  private account(row: Row): MailAccount {
    return {
      id: String(row.id),
      provider: String(row.provider) as MailAccount['provider'],
      email: String(row.email),
      displayName: String(row.display_name),
      signature: String(row.signature),
      syncEnabled: boolean(row.sync_enabled),
      lastSyncedAt: nullableNumber(row.last_synced_at),
      createdAt: number(row.created_at),
      updatedAt: number(row.updated_at)
    }
  }

  private label(row: Row): MailLabel {
    return {
      accountId: String(row.account_id),
      id: String(row.id),
      providerId: nullableString(row.provider_id),
      name: String(row.name),
      type: String(row.type) as MailLabel['type'],
      color: nullableString(row.color),
      unreadCount: number(row.unread_count),
      totalCount: number(row.total_count),
      createdAt: number(row.created_at),
      updatedAt: number(row.updated_at)
    }
  }

  private thread(row: Row): MailThread {
    return {
      accountId: String(row.account_id),
      id: String(row.id),
      providerThreadId: nullableString(row.provider_thread_id),
      subject: String(row.subject),
      snippet: String(row.snippet),
      latestAt: number(row.latest_at),
      messageCount: number(row.message_count),
      unreadCount: number(row.unread_count),
      createdAt: number(row.created_at),
      updatedAt: number(row.updated_at)
    }
  }

  private message(row: Row): MailMessage {
    const accountId = String(row.account_id)
    const id = String(row.id)
    const labels = (this.database.prepare(`
      SELECT l.* FROM labels l
      JOIN message_labels ml ON ml.account_id = l.account_id AND ml.label_id = l.id
      WHERE ml.account_id = ? AND ml.message_id = ?
      ORDER BY l.type, l.name, l.id
    `).all(accountId, id) as Row[]).map(item => this.label(item))
    const participants = (this.database.prepare('SELECT * FROM participants WHERE account_id = ? AND message_id = ? ORDER BY sort_order, id').all(accountId, id) as Row[]).map(item => this.participant(item))
    const attachments = (this.database.prepare('SELECT * FROM attachments WHERE account_id = ? AND message_id = ? ORDER BY id').all(accountId, id) as Row[]).map(item => this.attachment(item))
    return {
      accountId,
      id,
      providerMessageId: String(row.provider_message_id),
      threadId: nullableString(row.thread_id),
      messageIdHeader: nullableString(row.message_id_header),
      inReplyTo: nullableString(row.in_reply_to),
      subject: String(row.subject),
      snippet: String(row.snippet),
      bodyText: String(row.body_text),
      bodyHtml: nullableString(row.body_html),
      sentAt: nullableNumber(row.sent_at),
      receivedAt: number(row.received_at),
      isRead: boolean(row.is_read),
      isStarred: boolean(row.is_starred),
      isDraft: boolean(row.is_draft),
      isSent: boolean(row.is_sent),
      isTrashed: boolean(row.is_trashed),
      size: number(row.size),
      labels,
      participants,
      attachments,
      createdAt: number(row.created_at),
      updatedAt: number(row.updated_at)
    }
  }

  private participant(row: Row): MailParticipant {
    return {
      id: String(row.id),
      messageId: String(row.message_id ?? row.draft_id),
      role: String(row.role) as MailParticipant['role'],
      email: String(row.email),
      name: nullableString(row.name),
      order: number(row.sort_order)
    }
  }

  private attachment(row: Row): MailAttachment {
    return {
      accountId: String(row.account_id),
      id: String(row.id),
      messageId: nullableString(row.message_id),
      draftId: nullableString(row.draft_id),
      filename: String(row.filename),
      mimeType: String(row.mime_type),
      size: number(row.size),
      contentId: nullableString(row.content_id),
      inline: boolean(row.is_inline),
      storageKey: nullableString(row.storage_key),
      checksum: nullableString(row.checksum),
      createdAt: number(row.created_at)
    }
  }

  private draft(row: Row): MailDraft {
    const accountId = String(row.account_id)
    const id = String(row.id)
    const recipients = (this.database.prepare('SELECT * FROM draft_recipients WHERE account_id = ? AND draft_id = ? ORDER BY sort_order, id').all(accountId, id) as Row[]).map(item => this.participant(item))
    const attachments = (this.database.prepare('SELECT * FROM attachments WHERE account_id = ? AND draft_id = ? ORDER BY id').all(accountId, id) as Row[]).map(item => this.attachment(item))
    return {
      accountId,
      id,
      providerDraftId: nullableString(row.provider_draft_id),
      replyToMessageId: nullableString(row.reply_to_message_id),
      subject: String(row.subject),
      bodyText: String(row.body_text),
      bodyHtml: nullableString(row.body_html),
      recipients,
      attachments,
      version: number(row.version),
      createdAt: number(row.created_at),
      updatedAt: number(row.updated_at)
    }
  }

  private scheduledSend(row: Row): MailScheduledSend {
    return {
      accountId: String(row.account_id),
      id: String(row.id),
      draftId: String(row.draft_id),
      sendAt: number(row.send_at),
      status: String(row.status) as MailScheduleStatus,
      attemptCount: number(row.attempt_count),
      lastError: nullableString(row.last_error),
      providerRequestId: nullableString(row.provider_request_id),
      createdAt: number(row.created_at),
      updatedAt: number(row.updated_at)
    }
  }

  private snooze(row: Row): MailSnooze {
    return {
      accountId: String(row.account_id),
      id: String(row.id),
      threadId: nullableString(row.thread_id),
      messageId: nullableString(row.message_id),
      wakeAt: number(row.wake_at),
      createdAt: number(row.created_at)
    }
  }

  private transaction<T>(work: () => T): T {
    this.database.exec('BEGIN IMMEDIATE')
    try {
      const result = work()
      this.database.exec('COMMIT')
      return result
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL CHECK (provider IN (${MAIL_PROVIDERS.map(value => `'${value}'`).join(', ')})),
        email TEXT NOT NULL COLLATE NOCASE,
        display_name TEXT NOT NULL,
        signature TEXT NOT NULL DEFAULT '',
        sync_enabled INTEGER NOT NULL CHECK (sync_enabled IN (0, 1)),
        last_synced_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(provider, email)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS labels (
        account_id TEXT NOT NULL,
        id TEXT NOT NULL,
        provider_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN (${MAIL_LABEL_TYPES.map(value => `'${value}'`).join(', ')})),
        color TEXT,
        unread_count INTEGER NOT NULL CHECK (unread_count >= 0),
        total_count INTEGER NOT NULL CHECK (total_count >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(account_id, id),
        FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, provider_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS threads (
        account_id TEXT NOT NULL,
        id TEXT NOT NULL,
        provider_thread_id TEXT,
        subject TEXT NOT NULL,
        snippet TEXT NOT NULL,
        latest_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(account_id, id),
        FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, provider_thread_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS messages (
        account_id TEXT NOT NULL,
        id TEXT NOT NULL,
        provider_message_id TEXT NOT NULL,
        message_id_header TEXT,
        in_reply_to TEXT,
        subject TEXT NOT NULL,
        snippet TEXT NOT NULL,
        body_text TEXT NOT NULL,
        body_html TEXT,
        sent_at INTEGER,
        received_at INTEGER NOT NULL,
        is_read INTEGER NOT NULL CHECK (is_read IN (0, 1)),
        is_starred INTEGER NOT NULL CHECK (is_starred IN (0, 1)),
        is_draft INTEGER NOT NULL CHECK (is_draft IN (0, 1)),
        is_sent INTEGER NOT NULL CHECK (is_sent IN (0, 1)),
        is_trashed INTEGER NOT NULL CHECK (is_trashed IN (0, 1)),
        size INTEGER NOT NULL CHECK (size >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(account_id, id),
        FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, provider_message_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS thread_messages (
        account_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        PRIMARY KEY(account_id, message_id),
        FOREIGN KEY(account_id, thread_id) REFERENCES threads(account_id, id) ON DELETE CASCADE,
        FOREIGN KEY(account_id, message_id) REFERENCES messages(account_id, id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS message_labels (
        account_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        label_id TEXT NOT NULL,
        PRIMARY KEY(account_id, message_id, label_id),
        FOREIGN KEY(account_id, message_id) REFERENCES messages(account_id, id) ON DELETE CASCADE,
        FOREIGN KEY(account_id, label_id) REFERENCES labels(account_id, id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS participants (
        account_id TEXT NOT NULL,
        id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN (${MAIL_PARTICIPANT_ROLES.map(value => `'${value}'`).join(', ')})),
        email TEXT NOT NULL COLLATE NOCASE,
        name TEXT,
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        PRIMARY KEY(account_id, id),
        FOREIGN KEY(account_id, message_id) REFERENCES messages(account_id, id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS drafts (
        account_id TEXT NOT NULL,
        id TEXT NOT NULL,
        provider_draft_id TEXT,
        reply_to_message_id TEXT,
        subject TEXT NOT NULL,
        body_text TEXT NOT NULL,
        body_html TEXT,
        version INTEGER NOT NULL CHECK (version >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(account_id, id),
        FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, provider_draft_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS draft_recipients (
        account_id TEXT NOT NULL,
        id TEXT NOT NULL,
        draft_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN (${MAIL_PARTICIPANT_ROLES.map(value => `'${value}'`).join(', ')})),
        email TEXT NOT NULL COLLATE NOCASE,
        name TEXT,
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        PRIMARY KEY(account_id, id),
        FOREIGN KEY(account_id, draft_id) REFERENCES drafts(account_id, id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS attachments (
        account_id TEXT NOT NULL,
        id TEXT NOT NULL,
        message_id TEXT,
        draft_id TEXT,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL CHECK (size >= 0),
        content_id TEXT,
        is_inline INTEGER NOT NULL CHECK (is_inline IN (0, 1)),
        storage_key TEXT,
        checksum TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(account_id, id),
        FOREIGN KEY(account_id, message_id) REFERENCES messages(account_id, id) ON DELETE CASCADE,
        FOREIGN KEY(account_id, draft_id) REFERENCES drafts(account_id, id) ON DELETE CASCADE,
        CHECK ((message_id IS NULL) != (draft_id IS NULL))
      ) STRICT;

      CREATE TABLE IF NOT EXISTS scheduled_sends (
        account_id TEXT NOT NULL,
        id TEXT NOT NULL,
        draft_id TEXT NOT NULL,
        send_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN (${MAIL_SCHEDULE_STATUSES.map(value => `'${value}'`).join(', ')})),
        attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
        last_error TEXT,
        provider_request_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(account_id, id),
        FOREIGN KEY(account_id, draft_id) REFERENCES drafts(account_id, id) ON DELETE CASCADE,
        UNIQUE(account_id, draft_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS snoozes (
        account_id TEXT NOT NULL,
        id TEXT NOT NULL,
        thread_id TEXT,
        message_id TEXT,
        wake_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(account_id, id),
        FOREIGN KEY(account_id, thread_id) REFERENCES threads(account_id, id) ON DELETE CASCADE,
        FOREIGN KEY(account_id, message_id) REFERENCES messages(account_id, id) ON DELETE CASCADE,
        CHECK ((thread_id IS NULL) != (message_id IS NULL)),
        UNIQUE(account_id, thread_id),
        UNIQUE(account_id, message_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sync_cursors (
        account_id TEXT NOT NULL,
        resource TEXT NOT NULL,
        cursor TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(account_id, resource),
        FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
      ) STRICT;

      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        account_id UNINDEXED,
        message_id UNINDEXED,
        subject,
        body_text,
        participant_text,
        tokenize = 'unicode61 remove_diacritics 2'
      );

      CREATE INDEX IF NOT EXISTS messages_page ON messages(account_id, received_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS thread_messages_thread ON thread_messages(account_id, thread_id, message_id);
      CREATE INDEX IF NOT EXISTS scheduled_sends_due ON scheduled_sends(status, send_at);
      CREATE INDEX IF NOT EXISTS snoozes_due ON snoozes(wake_at);
      CREATE INDEX IF NOT EXISTS participants_message ON participants(account_id, message_id, sort_order, id);
      CREATE INDEX IF NOT EXISTS message_labels_label ON message_labels(account_id, label_id);
      CREATE INDEX IF NOT EXISTS attachments_message ON attachments(account_id, message_id);
      CREATE INDEX IF NOT EXISTS attachments_draft ON attachments(account_id, draft_id);
      CREATE INDEX IF NOT EXISTS attachments_id ON attachments(id);
      CREATE INDEX IF NOT EXISTS draft_recipients_draft ON draft_recipients(account_id, draft_id, sort_order, id);

      CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE account_id = old.account_id AND message_id = old.id;
      END;
    `)
    const columns = this.database.prepare('PRAGMA table_info(accounts)').all() as Row[]
    if (!columns.some(column => String(column.name) === 'signature')) {
      this.database.exec("ALTER TABLE accounts ADD COLUMN signature TEXT NOT NULL DEFAULT ''")
    }
  }
}
