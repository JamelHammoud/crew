import WebSocket from 'ws'
import { httpBaseFrom, type Attachment } from '../shared/attachments'
import { agentId, type AgentDef, type AgentSettings, type AgentUsage } from '../shared/llm'
import type { ClientMessage, RegisteredLlm, ServerMessage, SessionSnapshot } from '../shared/protocol'
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
  usagePollMs?: number
  // Called when this runner adopts one of its own agents remembered by the
  // server but missing locally, so the owner can persist the definition.
  onAdopt?: (def: AgentDef) => void
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
const USAGE_POLL_MS = 60000
const OUTBOX_LIMIT = 5000

const OUTBOX_TYPES = new Set(['agent.step', 'agent.tokens', 'agent.done', 'agent.error', 'agent.steered'])

export class Runner {
  private ws: WebSocket | null = null
  private providersByName = new Map<string, Provider>()
  private agents = new Map<string, RunnerAgent>()
  private running = new Map<string, RunningPrompt>()
  private accepted = new Set<string>()
  private cancelled = new Set<string>()
  private tails = new Map<string, Promise<void>>()
  private stopped = false
  private attempts = 0
  private baseDelay: number
  private silenceTimeout: number
  private reconnectTimer: NodeJS.Timeout | null = null
  private watchdog: NodeJS.Timeout | null = null
  private usageTimer: NodeJS.Timeout | null = null
  private pollingUsage = false
  private puller: GitPuller | null = null
  private attachments: AttachmentCache
  private httpBase = ''
  private lastSeen = 0
  private outbox: ClientMessage[] = []
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
    this.agents.delete(key)
    // Deregister even when the agent is unknown locally: the server may still
    // remember it (an offline ghost), and this is the only way to clear one.
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
      const pending = new Set(this.accepted)
      for (const msg of this.outbox) {
        if (msg.type === 'agent.done' || msg.type === 'agent.error') pending.add(msg.promptId)
      }
      this.send({
        type: 'hello',
        role: 'runner',
        name: this.opts.name,
        code: this.opts.code,
        llms: [...this.agents.values()].map(agent => this.registered(agent)),
        running: [...pending]
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
      this.stopUsagePolling()
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
    this.stopUsagePolling()
    this.puller?.stop()
    this.killRunning()
    this.ws?.close(1000)
  }

  dropConnection(): void {
    this.ws?.terminate()
  }

  private startWatchdog(ws: WebSocket): void {
    this.stopWatchdog()
    const interval = Math.max(50, Math.floor(this.silenceTimeout / 3))
    let lastTick = Date.now()
    let probed = false
    this.watchdog = setInterval(() => {
      const now = Date.now()
      const stalled = now - lastTick > interval * 3
      lastTick = now
      if (stalled) {
        this.lastSeen = now
        probed = false
        return
      }
      if (now - this.lastSeen <= this.silenceTimeout) {
        probed = false
        return
      }
      if (!probed) {
        probed = true
        try {
          ws.ping()
        } catch {
          ws.terminate()
        }
        return
      }
      ws.terminate()
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

  private startUsagePolling(): void {
    this.stopUsagePolling()
    const tick = () => void this.pollUsage()
    tick()
    this.usageTimer = setInterval(tick, this.opts.usagePollMs ?? USAGE_POLL_MS)
    this.usageTimer.unref?.()
  }

  private stopUsagePolling(): void {
    if (this.usageTimer) clearInterval(this.usageTimer)
    this.usageTimer = null
  }

  // All agents backed by the same provider share one account on this machine,
  // so usage is read once per provider and reported for each instance.
  private async pollUsage(): Promise<void> {
    if (this.pollingUsage) return
    this.pollingUsage = true
    try {
      const byProvider = new Map<Provider, string[]>()
      for (const agent of this.agents.values()) {
        if (!agent.provider.usage) continue
        const list = byProvider.get(agent.provider) ?? []
        list.push(agent.instanceId)
        byProvider.set(agent.provider, list)
      }
      for (const [provider, instanceIds] of byProvider) {
        let usage: AgentUsage | null = null
        try {
          usage = await provider.usage!()
        } catch {
          usage = null
        }
        if (!usage) continue
        for (const instanceId of instanceIds) this.send({ type: 'agent.usage', instanceId, usage })
      }
    } finally {
      this.pollingUsage = false
    }
  }

  private handle(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome': {
        this.attempts = 0
        this.onStatus?.('online')
        const queued = this.outbox
        this.outbox = []
        for (const buffered of queued) this.send(buffered)
        this.startUsagePolling()
        void this.adoptOwnAgents(msg.snapshot)
        break
      }
      case 'prompt':
        this.runPrompt(msg.promptId, msg.agentId, msg.threadId, msg.text, msg.settings, msg.attachments ?? [])
        break
      case 'steer':
        void this.steer(msg.promptId, msg.text, msg.byName, msg.attachments ?? [])
        break
      case 'cancel': {
        const live = this.running.get(msg.promptId)
        if (live) live.kill()
        else this.cancelled.add(msg.promptId)
        break
      }
    }
  }

  // The server remembers agents across restarts; if one of ours is offline in
  // the snapshot and its CLI is on this machine, the local definition was lost
  // (wiped store, fresh install), not the agent. Re-register it instead of
  // leaving a ghost the owner can see but never run.
  private async adoptOwnAgents(snapshot: SessionSnapshot): Promise<void> {
    const prefix = `${this.opts.name.trim().toLowerCase()}/`
    for (const agent of snapshot.agents) {
      if (!agent.id.startsWith(prefix) || agent.status !== 'offline') continue
      if (this.agents.has(agent.id)) continue
      const provider = this.providersByName.get(agent.provider)
      if (!provider || !(await provider.detect())) continue
      const def: AgentDef = {
        instanceId: agent.id.slice(prefix.length),
        provider: agent.provider,
        name: agent.label,
        settings: agent.settings ?? {}
      }
      const key = this.define(def)
      if (!key) continue
      this.send({ type: 'agent.register', llm: this.registered(this.agents.get(key)!) })
      this.opts.onAdopt?.(def)
    }
  }

  // The run may finish while the attachments are being fetched, so the ack is
  // what tells the server whether the message landed or needs re-queueing.
  private async steer(promptId: string, text: string, byName: string, attachments: Attachment[]): Promise<void> {
    const run = this.running.get(promptId)
    if (!run?.steer) {
      this.send({ type: 'agent.steered', promptId, ok: false })
      return
    }
    const framed = `New message from ${byName}:\n${text}`
    let body = framed
    try {
      body = promptWithAttachments(framed, await this.attachments.ensure(attachments, this.httpBase))
    } catch {
      // Fall back to the bare text rather than dropping the steer entirely.
    }
    const live = this.running.get(promptId)
    this.send({ type: 'agent.steered', promptId, ok: live === run && run.steer(body) })
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
    if (this.accepted.has(promptId)) return
    this.accepted.add(promptId)
    const tail = this.tails.get(threadId) ?? Promise.resolve()
    const next = tail
      .then(() => this.execute(agent.provider, promptId, text, settings, attachments))
      .catch(() => {})
    this.tails.set(threadId, next)
    void next.then(() => {
      this.accepted.delete(promptId)
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
    // A cancel can land before the provider process exists (during the pull or
    // attachment fetch, or while queued behind another run in this thread), so
    // it is remembered and honored here instead of being dropped.
    if (this.cancelled.delete(promptId)) {
      this.send({ type: 'agent.error', promptId, message: 'Stopped' })
      return
    }
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
      this.cancelled.delete(promptId)
    }
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
      return
    }
    if (!OUTBOX_TYPES.has(msg.type)) return
    this.outbox.push(msg)
    if (this.outbox.length > OUTBOX_LIMIT) {
      const drop = this.outbox.findIndex(m => m.type === 'agent.step' || m.type === 'agent.tokens')
      this.outbox.splice(drop === -1 ? 0 : drop, 1)
    }
  }
}
