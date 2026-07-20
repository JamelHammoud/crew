import WebSocket from 'ws'
import { httpBaseFrom, type Attachment } from '../shared/attachments'
import { agentId, type AgentDef, type AgentSettings } from '../shared/llm'
import type { ClientMessage, RegisteredLlm, ServerMessage } from '../shared/protocol'
import type { Provider, RunningPrompt } from './providers/types'
import { AttachmentCache, promptWithAttachments } from './attachments'
import { GitPuller } from './pull'

export interface RunnerOptions {
  name: string
  code: string
  repoPath: string
  providers: Provider[]
  agents?: AgentDef[]
  reconnectDelayMs?: number
  silenceTimeoutMs?: number
  autoPullMs?: number
}

interface RunnerAgent {
  instanceId: string
  provider: Provider
  name: string
  settings: AgentSettings
}

export type RunnerStatus = 'connecting' | 'online' | 'offline'

const MAX_DELAY_MS = 10000
const SILENCE_TIMEOUT_MS = 45000

export class Runner {
  private ws: WebSocket | null = null
  private providersByName = new Map<string, Provider>()
  private agents = new Map<string, RunnerAgent>()
  private running = new Map<string, RunningPrompt>()
  private tails = new Map<string, Promise<void>>()
  private stopped = false
  private attempts = 0
  private baseDelay: number
  private silenceTimeout: number
  private reconnectTimer: NodeJS.Timeout | null = null
  private watchdog: NodeJS.Timeout | null = null
  private puller: GitPuller | null = null
  private attachments: AttachmentCache
  private httpBase = ''
  private lastSeen = 0
  onStatus: ((status: RunnerStatus) => void) | null = null

  constructor(private opts: RunnerOptions) {
    for (const provider of opts.providers) this.providersByName.set(provider.name, provider)
    const defs = opts.agents ?? opts.providers.map(p => ({ instanceId: p.name, provider: p.name, name: p.label, settings: {} }))
    for (const def of defs) this.define(def)
    this.attachments = new AttachmentCache(opts.repoPath)
    this.baseDelay = opts.reconnectDelayMs ?? 1000
    this.silenceTimeout = opts.silenceTimeoutMs ?? SILENCE_TIMEOUT_MS
    if (opts.autoPullMs) {
      this.puller = new GitPuller(opts.repoPath)
      this.puller.onLog = line => console.warn('[git]', line)
      this.puller.start(opts.autoPullMs)
    }
  }

  addAgent(def: AgentDef): void {
    const key = this.define(def)
    if (!key) return
    this.send({ type: 'agent.register', llm: this.registered(this.agents.get(key)!) })
  }

  removeAgent(instanceId: string): void {
    const key = agentId(this.opts.name, instanceId)
    if (!this.agents.delete(key)) return
    this.send({ type: 'agent.deregister', instanceId })
  }

  private define(def: AgentDef): string | null {
    const provider = this.providersByName.get(def.provider)
    if (!provider) return null
    const key = agentId(this.opts.name, def.instanceId)
    this.agents.set(key, { instanceId: def.instanceId, provider, name: def.name, settings: def.settings ?? {} })
    return key
  }

  private registered(agent: RunnerAgent): RegisteredLlm {
    return {
      instanceId: agent.instanceId,
      provider: agent.provider.name,
      label: agent.name,
      fields: agent.provider.fields(),
      settings: agent.settings,
      steerable: agent.provider.steerable === true
    }
  }

  connect(url: string): void {
    if (this.stopped) return
    this.onStatus?.('connecting')
    this.httpBase = httpBaseFrom(url)
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
        llms: [...this.agents.values()].map(agent => this.registered(agent))
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
    this.puller?.stop()
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
        this.runPrompt(msg.promptId, msg.agentId, msg.threadId, msg.text, msg.settings, msg.attachments ?? [])
        break
      case 'cancel':
        this.running.get(msg.promptId)?.kill()
        break
    }
  }

  private runPrompt(
    promptId: string,
    forAgentId: string,
    threadId: string,
    text: string,
    settings: AgentSettings,
    attachments: Attachment[]
  ): void {
    const agent = this.agents.get(forAgentId)
    if (!agent) {
      this.send({ type: 'agent.error', promptId, message: 'That agent is not on this machine.' })
      return
    }
    const tail = this.tails.get(threadId) ?? Promise.resolve()
    const next = tail
      .then(() => this.execute(agent.provider, promptId, text, settings, attachments))
      .catch(() => {})
    this.tails.set(threadId, next)
    void next.then(() => {
      if (this.tails.get(threadId) === next) this.tails.delete(threadId)
    })
  }

  private async execute(
    provider: Provider,
    promptId: string,
    text: string,
    settings: AgentSettings,
    attachments: Attachment[]
  ): Promise<void> {
    await this.puller?.pullNow()
    const local = await this.attachments.ensure(attachments, this.httpBase)
    const run = provider.start(promptWithAttachments(text, local), this.opts.repoPath, {
      onStep: step => this.send({ type: 'agent.step', promptId, step }),
      onTokens: tokens => this.send({ type: 'agent.tokens', promptId, tokens })
    }, settings)
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
