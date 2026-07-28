import WebSocket from 'ws'
import { httpBaseFrom, type Attachment } from '../shared/attachments'
import { boardsPreamble, type DesignBoardMeta } from '../shared/design'
import { agentId, type AgentDef, type AgentSettings, type AgentUsage } from '../shared/llm'
import type { ClientMessage, RegisteredLlm, ServerMessage, SessionSnapshot } from '../shared/protocol'
import type { Provider, RunningPrompt } from './providers/types'
import { AttachmentCache, promptWithAttachments } from './attachments'

export interface RunnerOptions {
  name: string
  code: string
  repoPath: string
  providers: Provider[]
  agents?: AgentDef[]
  reconnectDelayMs?: number
  silenceTimeoutMs?: number
  usagePollMs?: number
  // Called before a prompt starts so the agent works from the newest code.
  onBeforeRun?: () => Promise<void>
  // Called when one of this runner's agents is removed from the session by
  // anyone, so the owner can drop the local definition too.
  onForget?: (instanceId: string) => void
  // Called when one of this runner's agents is renamed in the session.
  onRename?: (instanceId: string, name: string) => void
}

interface RunnerAgent {
  id: string
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
  private attachments: AttachmentCache
  private httpBase = ''
  private lastSeen = 0
  private outbox: ClientMessage[] = []
  onStatus: ((status: RunnerStatus) => void) | null = null

  constructor(private opts: RunnerOptions) {
    for (const provider of opts.providers) this.providersByName.set(provider.name, provider)
    for (const def of opts.agents ?? []) this.define(def)
    this.attachments = new AttachmentCache(opts.repoPath)
    this.baseDelay = opts.reconnectDelayMs ?? 1000
    this.silenceTimeout = opts.silenceTimeoutMs ?? SILENCE_TIMEOUT_MS
  }

  addAgent(def: AgentDef): void {
    const key = this.define(def)
    if (!key) return
    this.send({ type: 'agent.register', llm: this.registered(this.agents.get(key)!) })
  }

  removeAgent(instanceId: string): void {
    const agent = [...this.agents.values()].find(a => a.instanceId === instanceId)
    if (!agent) return
    this.agents.delete(agent.id)
    // Deregister even when the agent is offline on the server: this is the only
    // way to clear one it still remembers.
    this.send({ type: 'agent.deregister', agentId: agent.id })
  }

  private define(def: AgentDef): string | null {
    const provider = this.providersByName.get(def.provider)
    if (!provider) return null
    const id = def.id ?? agentId(this.opts.name, def.instanceId)
    this.agents.set(id, {
      id,
      instanceId: def.instanceId,
      provider,
      name: def.name,
      settings: def.settings ?? {}
    })
    return id
  }

  private registered(agent: RunnerAgent): RegisteredLlm {
    return {
      id: agent.id,
      instanceId: agent.instanceId,
      provider: agent.provider.name,
      label: agent.name,
      fields: agent.provider.fields(),
      settings: agent.settings,
      steerable: agent.provider.steerable === true
    }
  }

  // Connecting again is how a runner follows a host that has moved, so anything
  // owed to the socket being left goes here rather than in its own close.
  connect(url: string): void {
    if (this.stopped) return
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    const previous = this.ws
    this.onStatus?.('connecting')
    this.httpBase = httpBaseFrom(url)
    const ws = new WebSocket(url)
    this.ws = ws
    previous?.close(1000)
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
      // A socket that is no longer the one being held drives nothing. Without
      // this the one left behind takes down the new one's watchdog and queues a
      // reconnect to where the host used to be.
      if (this.ws !== ws) return
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
        list.push(agent.id)
        byProvider.set(agent.provider, list)
      }
      for (const [provider, ids] of byProvider) {
        let usage: AgentUsage | null = null
        try {
          usage = await provider.usage!()
        } catch {
          usage = null
        }
        if (!usage) continue
        for (const id of ids) this.send({ type: 'agent.usage', agentId: id, usage })
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
        break
      }
      case 'prompt':
        this.runPrompt(
          msg.promptId,
          msg.agentId,
          msg.threadId,
          msg.text,
          msg.settings,
          msg.attachments ?? [],
          msg.designBoard,
          msg.designBoards ?? []
        )
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
      case 'agent.removed': {
        const instanceId = this.ownInstance(msg.agentId)
        if (!instanceId) break
        this.agents.delete(msg.agentId)
        this.opts.onForget?.(instanceId)
        break
      }
      case 'agent.renamed': {
        const instanceId = this.ownInstance(msg.agentId)
        const agent = this.agents.get(msg.agentId)
        if (!instanceId || !agent) break
        agent.name = msg.label
        this.opts.onRename?.(instanceId, msg.label)
        break
      }
    }
  }

  private ownInstance(id: string): string | null {
    return this.agents.get(id)?.instanceId ?? null
  }

  // The run may finish while the attachments are being fetched, so the ack is
  // what tells the server whether the message landed or needs re-queueing.
  private async steer(
    promptId: string,
    text: string,
    byName: string,
    attachments: Attachment[],
    ghost = false
  ): Promise<void> {
    const run = this.running.get(promptId)
    if (!run?.steer) {
      this.send({ type: 'agent.steered', promptId, ok: false })
      return
    }
    const framed = `New message from ${byName}:\n${text}`
    let body = framed
    try {
      const local = await this.attachments.ensure(attachments, this.httpBase, ghost ? promptId : undefined)
      body = promptWithAttachments(framed, local)
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
    attachments: Attachment[],
    designBoard?: DesignBoardMeta,
    designBoards: DesignBoardMeta[] = [],
    ghost = false
  ): void {
    const agent = this.agents.get(forAgentId)
    if (!agent) {
      this.send({ type: 'agent.error', promptId, message: 'That agent is not on this machine.' })
      return
    }
    if (this.accepted.has(promptId)) return
    this.accepted.add(promptId)
    // The design preamble is written here rather than on the host because only
    // this side knows the http address it reaches the server at.
    const preamble = boardsPreamble(this.httpBase, forAgentId, designBoard, designBoards)
    const body = preamble ? `${text}\n\n${preamble}` : text
    const tail = this.tails.get(threadId) ?? Promise.resolve()
    const next = tail
      .then(() => this.execute(agent.provider, promptId, body, settings, attachments))
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
    await this.opts.onBeforeRun?.().catch(() => {})
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
