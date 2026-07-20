import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'
import type { SessionEvent } from '../../src/shared/events'
import type { AgentStep } from '../../src/shared/llm'
import type { ClientMessage, ServerMessage } from '../../src/shared/protocol'
import { createCrewServer, type CrewServer } from '../../src/server/index'
import { CrewSession } from '../../src/server/session'
import { Store } from '../../src/server/store'

export function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `crew-${prefix}-`))
}

export async function waitUntil(pred: () => boolean | Promise<boolean>, timeoutMs = 10000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await pred()) return
    await new Promise(r => setTimeout(r, 100))
  }
  if (!(await pred())) throw new Error('waitUntil timed out')
}

export interface TestHost {
  server: CrewServer
  session: CrewSession
  store: Store
  code: string
  url: string
  repoPath: string
  close: () => Promise<void>
}

export async function startHost(repoPath: string = tmpDir('host'), opts: { heartbeatMs?: number } = {}): Promise<TestHost> {
  const store = new Store(repoPath)
  const session = new CrewSession(store)
  const server = await createCrewServer(session, { port: 0, host: '127.0.0.1', heartbeatMs: opts.heartbeatMs })
  return {
    server,
    session,
    store,
    code: session.code,
    url: `ws://127.0.0.1:${server.port()}/ws`,
    repoPath,
    close: () => server.close()
  }
}

interface Waiter<T> {
  pred: (item: T) => boolean
  resolve: (item: T) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}

export class TestUi {
  messages: ServerMessage[] = []
  events: SessionEvent[] = []
  steps: Array<{ promptId: string; agentId: string; threadId: string; step: AgentStep }> = []
  selfId = ''
  private waiters: Array<Waiter<ServerMessage>> = []
  private eventWaiters: Array<Waiter<SessionEvent>> = []

  private constructor(private ws: WebSocket) {}

  static connect(url: string, name: string, code: string): Promise<TestUi> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      const ui = new TestUi(ws)
      const timer = setTimeout(() => reject(new Error('welcome timed out')), 10000)
      ws.on('open', () => {
        const hello: ClientMessage = { type: 'hello', role: 'ui', name, code }
        ws.send(JSON.stringify(hello))
      })
      ws.on('message', raw => {
        const msg = JSON.parse(raw.toString()) as ServerMessage
        if (msg.type === 'welcome') ui.selfId = msg.selfId
        if (msg.type === 'event') {
          ui.events.push(msg.event)
          ui.eventWaiters = ui.eventWaiters.filter(w => {
            if (w.pred(msg.event)) {
              clearTimeout(w.timer)
              w.resolve(msg.event)
              return false
            }
            return true
          })
        }
        if (msg.type === 'agent.step') {
          ui.steps.push({
            promptId: msg.promptId,
            agentId: msg.agentId,
            threadId: msg.threadId,
            step: msg.step
          })
        }
        ui.messages.push(msg)
        ui.waiters = ui.waiters.filter(w => {
          if (w.pred(msg)) {
            clearTimeout(w.timer)
            w.resolve(msg)
            return false
          }
          return true
        })
        if (msg.type === 'welcome') {
          clearTimeout(timer)
          resolve(ui)
        }
        if (msg.type === 'error') {
          clearTimeout(timer)
          reject(new Error(msg.message))
        }
      })
      ws.on('error', err => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  send(msg: ClientMessage): void {
    this.ws.send(JSON.stringify(msg))
  }

  chat(text: string, mentions: string[] = [], threadId?: string): void {
    this.send({ type: 'chat.send', text, mentions, threadId })
  }

  cancel(promptId: string): void {
    this.send({ type: 'prompt.cancel', promptId })
  }

  waitFor(pred: (msg: ServerMessage) => boolean, timeoutMs = 10000): Promise<ServerMessage> {
    const existing = this.messages.find(pred)
    if (existing) return Promise.resolve(existing)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('waitFor timed out')), timeoutMs)
      this.waiters.push({ pred, resolve, reject, timer })
    })
  }

  waitForEvent(pred: (event: SessionEvent) => boolean, timeoutMs = 10000): Promise<SessionEvent> {
    const existing = this.events.find(pred)
    if (existing) return Promise.resolve(existing)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('waitForEvent timed out')), timeoutMs)
      this.eventWaiters.push({ pred, resolve, reject, timer })
    })
  }

  close(): void {
    this.ws.close()
  }

  pauseTransport(): void {
    ;(this.ws as unknown as { _socket: { pause: () => void } })._socket.pause()
  }

  waitForClose(timeoutMs = 10000): Promise<void> {
    if (this.ws.readyState === WebSocket.CLOSED) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('waitForClose timed out')), timeoutMs)
      this.ws.once('close', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }
}
