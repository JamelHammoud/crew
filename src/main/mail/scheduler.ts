import { randomUUID } from 'node:crypto'

export interface ScheduledSend<Payload = unknown> {
  id: string
  accountId: string
  payload: Payload
  sendAt: number
  createdAt: number
  attempts: number
  retryAt?: number
  failedAt?: number
  lastError?: string
}

export interface SnoozedMessage {
  id: string
  accountId: string
  messageId: string
  wakeAt: number
  createdAt: number
  mailboxId?: string
}

export interface MailSchedulerStore<Payload = unknown> {
  listScheduledSends(): ScheduledSend<Payload>[] | Promise<ScheduledSend<Payload>[]>
  putScheduledSend(item: ScheduledSend<Payload>): void | Promise<void>
  removeScheduledSend(id: string): void | Promise<void>
  listSnoozedMessages(): SnoozedMessage[] | Promise<SnoozedMessage[]>
  putSnoozedMessage(item: SnoozedMessage): void | Promise<void>
  removeSnoozedMessage(id: string): void | Promise<void>
}

export interface MailSchedulerActions<Payload = unknown> {
  send(item: ScheduledSend<Payload>): void | Promise<void>
  restore(item: SnoozedMessage): void | Promise<void>
}

export type MailSchedulerEvent<Payload = unknown> =
  | { type: 'send:scheduled'; item: ScheduledSend<Payload> }
  | { type: 'send:sent'; item: ScheduledSend<Payload> }
  | { type: 'send:failed'; item: ScheduledSend<Payload>; error: string }
  | { type: 'snooze:scheduled'; item: SnoozedMessage }
  | { type: 'snooze:restored'; item: SnoozedMessage }
  | { type: 'snooze:failed'; item: SnoozedMessage; error: string }

export interface MailSchedulerOptions<Payload = unknown> {
  store: MailSchedulerStore<Payload>
  actions: MailSchedulerActions<Payload>
  onEvent?: (event: MailSchedulerEvent<Payload>) => void
  clock?: () => number
  maxSendAttempts?: number
  retryBaseMs?: number
  retryMaxMs?: number
}

const MAX_TIMER = 2_147_483_647

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function sendDue(item: ScheduledSend, now: number): boolean {
  if (item.failedAt !== undefined) return false
  return (item.retryAt ?? item.sendAt) <= now
}

export class MailScheduler<Payload = unknown> {
  private readonly store: MailSchedulerStore<Payload>
  private readonly actions: MailSchedulerActions<Payload>
  private readonly onEvent?: (event: MailSchedulerEvent<Payload>) => void
  private readonly clock: () => number
  private readonly maxSendAttempts: number
  private readonly retryBaseMs: number
  private readonly retryMaxMs: number
  private timer: ReturnType<typeof setTimeout> | null = null
  private running: Promise<void> = Promise.resolve()
  private active = false
  private generation = 0

  constructor(options: MailSchedulerOptions<Payload>) {
    this.store = options.store
    this.actions = options.actions
    this.onEvent = options.onEvent
    this.clock = options.clock ?? Date.now
    this.maxSendAttempts = Math.max(1, options.maxSendAttempts ?? 5)
    this.retryBaseMs = Math.max(1_000, options.retryBaseMs ?? 30_000)
    this.retryMaxMs = Math.max(this.retryBaseMs, options.retryMaxMs ?? 30 * 60_000)
  }

  async start(): Promise<void> {
    if (this.active) return this.running
    this.active = true
    this.generation += 1
    await this.drain()
  }

  async stop(): Promise<void> {
    this.active = false
    this.generation += 1
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    await this.running
  }

  schedule(accountId: string, payload: Payload, sendAt: number): Promise<ScheduledSend<Payload>> {
    if (!Number.isFinite(sendAt)) return Promise.reject(new TypeError('Invalid send time'))
    const item: ScheduledSend<Payload> = {
      id: randomUUID(),
      accountId,
      payload,
      sendAt,
      createdAt: this.clock(),
      attempts: 0
    }
    return this.enqueue(async () => {
      await this.store.putScheduledSend(item)
      this.onEvent?.({ type: 'send:scheduled', item })
      await this.runDue()
      return item
    })
  }

  cancelScheduledSend(id: string): Promise<void> {
    return this.enqueue(async () => {
      await this.store.removeScheduledSend(id)
      await this.arm()
    })
  }

  snooze(
    accountId: string,
    messageId: string,
    wakeAt: number,
    mailboxId?: string
  ): Promise<SnoozedMessage> {
    if (!Number.isFinite(wakeAt)) return Promise.reject(new TypeError('Invalid wake time'))
    const item: SnoozedMessage = {
      id: randomUUID(),
      accountId,
      messageId,
      wakeAt,
      createdAt: this.clock(),
      ...(mailboxId ? { mailboxId } : {})
    }
    return this.enqueue(async () => {
      await this.store.putSnoozedMessage(item)
      this.onEvent?.({ type: 'snooze:scheduled', item })
      await this.runDue()
      return item
    })
  }

  cancelSnooze(id: string): Promise<void> {
    return this.enqueue(async () => {
      await this.store.removeSnoozedMessage(id)
      await this.arm()
    })
  }

  wake(): Promise<void> {
    return this.enqueue(() => this.runDue())
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.running.then(work, work)
    this.running = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  private drain(): Promise<void> {
    return this.enqueue(() => this.runDue())
  }

  private async runDue(): Promise<void> {
    if (!this.active) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const generation = this.generation
    const now = this.clock()
    const [sends, snoozes] = await Promise.all([
      this.store.listScheduledSends(),
      this.store.listSnoozedMessages()
    ])
    const dueSends = sends
      .filter(item => sendDue(item, now))
      .sort((a, b) => (a.retryAt ?? a.sendAt) - (b.retryAt ?? b.sendAt) || a.createdAt - b.createdAt)
    const dueSnoozes = snoozes
      .filter(item => item.wakeAt <= now)
      .sort((a, b) => a.wakeAt - b.wakeAt || a.createdAt - b.createdAt)
    for (const item of dueSends) {
      if (!this.active || generation !== this.generation) return
      await this.deliver(item)
    }
    for (const item of dueSnoozes) {
      if (!this.active || generation !== this.generation) return
      await this.restore(item)
    }
    await this.arm()
  }

  private async deliver(item: ScheduledSend<Payload>): Promise<void> {
    try {
      await this.actions.send(item)
      await this.store.removeScheduledSend(item.id)
      this.onEvent?.({ type: 'send:sent', item })
    } catch (error) {
      const attempts = item.attempts + 1
      const lastError = messageFrom(error)
      const failed = attempts >= this.maxSendAttempts
      const retryMs = Math.min(this.retryMaxMs, this.retryBaseMs * 2 ** Math.max(0, attempts - 1))
      const updated: ScheduledSend<Payload> = {
        ...item,
        attempts,
        lastError,
        ...(failed ? { failedAt: this.clock() } : { retryAt: this.clock() + retryMs })
      }
      await this.store.putScheduledSend(updated)
      if (failed) this.onEvent?.({ type: 'send:failed', item: updated, error: lastError })
    }
  }

  private async restore(item: SnoozedMessage): Promise<void> {
    try {
      await this.actions.restore(item)
      await this.store.removeSnoozedMessage(item.id)
      this.onEvent?.({ type: 'snooze:restored', item })
    } catch (error) {
      this.onEvent?.({ type: 'snooze:failed', item, error: messageFrom(error) })
    }
  }

  private async arm(): Promise<void> {
    if (!this.active) return
    if (this.timer) clearTimeout(this.timer)
    const [sends, snoozes] = await Promise.all([
      this.store.listScheduledSends(),
      this.store.listSnoozedMessages()
    ])
    const times = [
      ...sends.filter(item => item.failedAt === undefined).map(item => item.retryAt ?? item.sendAt),
      ...snoozes.map(item => item.wakeAt)
    ]
    if (!times.length) {
      this.timer = null
      return
    }
    const delay = Math.min(MAX_TIMER, Math.max(0, Math.min(...times) - this.clock()))
    const generation = this.generation
    this.timer = setTimeout(() => {
      this.timer = null
      if (!this.active || generation !== this.generation) return
      void this.drain()
    }, delay)
  }
}
