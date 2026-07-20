import WebSocket from 'ws'
import { agentId } from '../shared/llm'
import type { ClientMessage, ServerMessage } from '../shared/protocol'
import type { Provider, RunningPrompt } from './providers/types'

export interface RunnerOptions {
  name: string
  code: string
  repoPath: string
  providers: Provider[]
  reconnectDelayMs?: number
  silenceTimeoutMs?: number
}

export type RunnerStatus = 'connecting' | 'online' | 'offline'

const MAX_DELAY_MS = 10000
const SILENCE_TIMEOUT_MS = 45000

export class Runner {
  private ws: WebSocket | null = null
  private providers = new Map<string, Provider>()
  private running = new Map<string, RunningPrompt>()
  private tails = new Map<string, Promise<void>>()
  private stopped = false
  private attempts = 0
  private baseDelay: number
  private silenceTimeout: number
  private reconnectTimer: NodeJS.Timeout | null = null
  private watchdog: NodeJS.Timeout | null = null
  private lastSeen = 0
  onStatus: ((status: RunnerStatus) => void) | null = null

  constructor(private opts: RunnerOptions) {
    for (const provider of opts.providers) {
      this.providers.set(agentId(opts.name, provider.name), provider)
    }
    this.baseDelay = opts.reconnectDelayMs ?? 1000
    this.silenceTimeout = opts.silenceTimeoutMs ?? SILENCE_TIMEOUT_MS
  }

  connect(url: string): void {
    if (this.stopped) return
    this.onStatus?.('connecting')
    const ws = new WebSocket(url)
    this.ws = ws
    this.lastSeen = Date.now()
    ws.on('open', () => {
      this.lastSeen = Date.now()
      this.send({
        type: 'hello',
        role: 'runner',
        name: this.opts.name,
        code: this.opts.code,
        llms: [...this.providers.values()].map(p => ({ provider: p.name, label: p.label }))
      })
    })
    ws.on('message', raw => {
      this.lastSeen = Date.now()
      let msg: ServerMessage
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      this.handle(msg)
    })
    ws.on('ping', () => {
      this.lastSeen = Date.now()
    })
    ws.on('pong', () => {
      this.lastSeen = Date.now()
    })
    ws.on('error', () => {})
    ws.on('close', () => {
      this.stopWatchdog()
      this.killRunning()
      this.onStatus?.('offline')
      if (this.stopped) return
      const wait = Math.min(this.baseDelay * 2 ** this.attempts, MAX_DELAY_MS)
      this.attempts++
      this.reconnectTimer = setTimeout(() => this.connect(url), wait)
      this.reconnectTimer.unref?.()
    })
    this.startWatchdog(ws)
  }

  close(): void {
    this.stopped = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.stopWatchdog()
    this.killRunning()
    this.ws?.close()
  }

  dropConnection(): void {
    this.ws?.terminate()
  }

  private startWatchdog(ws: WebSocket): void {
    this.stopWatchdog()
    const interval = Math.max(50, Math.floor(this.silenceTimeout / 3))
    this.watchdog = setInterval(() => {
      if (Date.now() - this.lastSeen > this.silenceTimeout) ws.terminate()
    }, interval)
    this.watchdog.unref?.()
  }

  private stopWatchdog(): void {
    if (this.watchdog) clearInterval(this.watchdog)
    this.watchdog = null
  }

  private killRunning(): void {
    for (const run of this.running.values()) run.kill()
  }

  private handle(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome':
        this.attempts = 0
        this.onStatus?.('online')
        break
      case 'prompt':
        this.runPrompt(msg.promptId, msg.agentId, msg.text)
        break
      case 'cancel':
        this.running.get(msg.promptId)?.kill()
        break
    }
  }

  private runPrompt(promptId: string, forAgentId: string, text: string): void {
    const provider = this.providers.get(forAgentId)
    if (!provider) {
      this.send({ type: 'agent.error', promptId, message: 'That agent is not on this machine.' })
      return
    }
    const tail = this.tails.get(provider.name) ?? Promise.resolve()
    const next = tail.then(() => this.execute(provider, promptId, text))
    this.tails.set(provider.name, next.catch(() => {}))
  }

  private async execute(provider: Provider, promptId: string, text: string): Promise<void> {
    const run = provider.start(text, this.opts.repoPath, {
      onChunk: chunk => this.send({ type: 'agent.chunk', promptId, text: chunk }),
      onActivity: activity =>
        this.send({
          type: 'agent.activity',
          promptId,
          activity: {
            id: activity.id,
            kind: activity.kind,
            name: activity.name,
            status: activity.status === 'started' ? 'running' : 'done',
            detail: activity.detail
          }
        })
    })
    this.running.set(promptId, run)
    try {
      const { text: reply } = await run.done
      this.send({ type: 'agent.done', promptId, text: reply })
    } catch (err) {
      this.send({ type: 'agent.error', promptId, message: err instanceof Error ? err.message : String(err) })
    } finally {
      this.running.delete(promptId)
    }
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }
}
