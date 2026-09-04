import WebSocket from 'ws'
import { httpBaseFrom, type Attachment } from '../shared/attachments'
import { boardsPreamble, type DesignBoardMeta } from '../shared/design'
import { agentId, type AgentDef, type AgentSettings, type AgentUsage } from '../shared/llm'
import { pagePreamble } from '../shared/showPage'
import { subagentPreamble } from '../shared/subagents'
import { memoryPreamble, type CrewMemory } from '../shared/memory'
import { pluginKey, type CrewPlugin } from '../shared/plugins'
import { pluginPreamble } from '../shared/pluginPreamble'
import { ticketPreamble } from '../shared/tickets'
import { iosPreamble } from '../shared/iosAgent'
import { hasIosProject } from '../shared/iosProject'
import { MAX_FRAME_BYTES } from '../shared/protocol'
import type { ClientMessage, RegisteredLlm, ServerMessage } from '../shared/protocol'
import { serverProviderNamed } from './providers/local'
import type { Provider, RunningPrompt } from './providers/types'
import { AttachmentCache, promptWithAttachments } from './attachments'
import { closeMcp, openMcp } from './plugins'
import { authorizeAttachedPlugin, pluginAvailable } from './pluginOauth'

type PluginAuthorization = (
  plugins: readonly CrewPlugin[],
  usePlugin?: string
) => Promise<Record<string, Record<string, string>>>

export interface RunnerOptions {
  name: string
  code: string
  repoPath: string
  // The folder the crew lives in on this machine, which is the project itself
  // only when the crew rides in it. Left out, nothing of the crew's is written
  // into the project at all.
  crewBase?: string | null
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
  onSettings?: (instanceId: string, settings: AgentSettings) => void
  onMessage?: (message: ServerMessage) => void
  authorizePlugins?: PluginAuthorization
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

// How long the answer to whether this folder builds an iPhone app is kept while
// it is still no. A project made mid-session is worth catching, and a walk on
// every prompt is a folder read nobody asked for.
const IOS_LOOK_MS = 60_000
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
  private spoken = new Set<string>()
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
  private iosApp = false
  private iosLookedAt = 0
  private lastSeen = 0
  private outbox: ClientMessage[] = []
  onStatus: ((status: RunnerStatus) => void) | null = null

  constructor(private opts: RunnerOptions) {
    for (const provider of opts.providers) this.providersByName.set(provider.name, provider)
    for (const def of opts.agents ?? []) this.define(def)
    this.attachments = new AttachmentCache(opts.crewBase ?? null)
    this.baseDelay = opts.reconnectDelayMs ?? 1000
    this.silenceTimeout = opts.silenceTimeoutMs ?? SILENCE_TIMEOUT_MS
    this.lookForIosApp()
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

  renameOwner(name: string): void {
    this.opts.name = name
  }

  private define(def: AgentDef): string | null {
    // A server written down after this runner was built is a provider it has
    // never been handed, so the store is asked rather than only the map, the
    // same reason every builtin is in there whether or not its CLI was found.
    const provider = this.providersByName.get(def.provider) ?? serverProviderNamed(def.provider)
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
    const ws = new WebSocket(url, { maxPayload: MAX_FRAME_BYTES })
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
      this.opts.onMessage?.(msg)
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

  private async pollUsage(): Promise<void> {
    if (this.pollingUsage) return
    this.pollingUsage = true
    try {
      for (const agent of this.agents.values()) {
        if (!agent.provider.usage) continue
        let usage: AgentUsage | null = null
        try {
          usage = await agent.provider.usage(agent.settings)
        } catch {
          usage = null
        }
        if (!usage) continue
        this.send({ type: 'agent.usage', agentId: agent.id, usage })
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
        if (msg.voice) this.spoken.add(msg.promptId)
        this.runPrompt(
          msg.promptId,
          msg.agentId,
          msg.threadId,
          msg.text,
          msg.settings,
          msg.attachments ?? [],
          msg.designBoard,
          msg.designBoards ?? [],
          msg.ghost === true,
          msg.spawnRoom ?? 0,
          msg.spawnProviders ?? [],
          msg.helpers === true,
          msg.tickets === true,
          msg.goal,
          msg.memories,
          msg.plugins,
          msg.usePlugin
        )
        break
      case 'steer':
        void this.steer(
          msg.promptId,
          msg.text,
          msg.byName,
          msg.attachments ?? [],
          msg.ghost === true,
          msg.from?.kind === 'subagent'
        )
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
      case 'event': {
        if (msg.event.kind !== 'agent.updated') break
        const agent = this.agents.get(msg.event.agentId)
        if (!agent) break
        agent.settings = msg.event.settings
        this.opts.onSettings?.(agent.instanceId, agent.settings)
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
    ghost = false,
    fromHelper = false
  ): Promise<void> {
    const run = this.running.get(promptId)
    if (!run?.steer) {
      this.send({ type: 'agent.steered', promptId, ok: false })
      return
    }
    // A helper coming back is not somebody talking, and the host has already
    // written the whole of what to read, so it goes over as it stands.
    const framed = fromHelper ? text : `New message from ${byName}:\n${text}`
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

  // Whether this folder builds an iPhone app decides whether an agent hears
  // about the simulator at all, so nobody has to say so with a command. The
  // walk is a folder read, so it is answered once and only asked again while
  // the answer is still no.
  private lookForIosApp(): void {
    if (this.iosApp || Date.now() - this.iosLookedAt < IOS_LOOK_MS) return
    this.iosLookedAt = Date.now()
    void hasIosProject(this.opts.repoPath)
      .then(found => {
        this.iosApp = found
      })
      .catch(() => undefined)
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
    ghost = false,
    spawnRoom = 0,
    spawnProviders: string[] = [],
    helpers = spawnRoom > 0,
    tickets = false,
    goal?: string,
    memories?: CrewMemory[],
    plugins?: CrewPlugin[],
    usePlugin?: string
  ): void {
    const agent = this.agents.get(forAgentId)
    if (!agent) {
      this.spoken.delete(promptId)
      this.send({ type: 'agent.error', promptId, message: 'That agent is not on this machine.' })
      return
    }
    const wantedPlugin = usePlugin ? pluginKey(usePlugin) : ''
    const selectedPlugin = wantedPlugin ? plugins?.find(plugin => pluginKey(plugin.name) === wantedPlugin) : undefined
    if (wantedPlugin && !selectedPlugin) {
      this.send({ type: 'agent.error', promptId, message: 'That plugin is not plugged in.' })
      return
    }
    if (usePlugin && !agent.provider.mcp) {
      this.send({
        type: 'agent.error',
        promptId,
        message: `${selectedPlugin?.label || selectedPlugin?.name || 'That plugin'} is not available to ${agent.name}. Choose another agent.`
      })
      return
    }
    if (this.accepted.has(promptId)) return
    this.accepted.add(promptId)
    this.lookForIosApp()
    const held = plugins ?? []
    const reachable = !agent.provider.mcp ? [] : this.opts.authorizePlugins ? held : held.filter(pluginAvailable)
    const preambles = [
      memories ? memoryPreamble(this.httpBase, promptId, memories) : '',
      boardsPreamble(this.httpBase, forAgentId, designBoard, designBoards, reachable),
      subagentPreamble(this.httpBase, promptId, spawnRoom, spawnProviders, helpers),
      pagePreamble(this.httpBase, promptId),
      pluginPreamble(this.httpBase, promptId, plugins ?? [], Boolean(agent.provider.mcp), usePlugin),
      tickets ? ticketPreamble(this.httpBase, promptId) : '',
      this.iosApp ? iosPreamble(this.httpBase, promptId, this.opts.repoPath) : ''
    ].filter(Boolean)
    const body = [text, ...preambles].join('\n\n')
    const tail = this.tails.get(threadId) ?? Promise.resolve()
    const next = tail
      .then(() => this.execute(agent.provider, promptId, body, settings, attachments, ghost, goal, plugins, usePlugin))
      .catch(() => {})
    this.tails.set(threadId, next)
    void next.then(() => {
      this.accepted.delete(promptId)
      if (ghost) this.attachments.release(promptId)
      if (this.tails.get(threadId) === next) this.tails.delete(threadId)
    })
  }

  private async execute(
    provider: Provider,
    promptId: string,
    text: string,
    settings: AgentSettings,
    attachments: Attachment[],
    ghost = false,
    goal?: string,
    plugins: CrewPlugin[] = [],
    usePlugin?: string
  ): Promise<void> {
    const pass = this.opts.onBeforeRun?.().catch(() => {})
    if (!this.spoken.delete(promptId)) await pass
    const local = await this.attachments.ensure(attachments, this.httpBase, ghost ? promptId : undefined)
    // A cancel can land before the provider process exists (during the pull or
    // attachment fetch, or while queued behind another run in this thread), so
    // it is remembered and honored here instead of being dropped.
    if (this.cancelled.delete(promptId)) {
      this.send({ type: 'agent.error', promptId, message: 'Stopped' })
      return
    }
    let mcp = null
    try {
      const candidates = usePlugin ? plugins.filter(plugin => pluginKey(plugin.name) === pluginKey(usePlugin)) : plugins
      const runPlugins = this.opts.authorizePlugins ? candidates : candidates.filter(pluginAvailable)
      if (usePlugin && candidates.length > 0 && runPlugins.length === 0) {
        throw new Error(
          `${candidates[0].label ?? candidates[0].name} is not connected on this computer. Connect it in Plugins.`
        )
      }
      const authorization = provider.mcp
        ? await (this.opts.authorizePlugins ?? authorizeAttachedPlugin)(runPlugins, usePlugin)
        : {}
      if (this.cancelled.delete(promptId)) throw new Error('Stopped')
      mcp = openMcp(runPlugins, provider.mcp, promptId, authorization)
      const run = provider.start(
        promptWithAttachments(text, local),
        this.opts.repoPath,
        {
          onStep: step => this.send({ type: 'agent.step', promptId, step }),
          onTokens: (tokens, cost) => this.send({ type: 'agent.tokens', promptId, tokens, cost: cost ?? undefined })
        },
        settings,
        { goal, mcp: mcp ?? undefined }
      )
      this.running.set(promptId, run)
      const { text: reply } = await run.done
      this.send({ type: 'agent.done', promptId, text: reply })
    } catch (err) {
      this.send({ type: 'agent.error', promptId, message: err instanceof Error ? err.message : String(err) })
    } finally {
      closeMcp(mcp)
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
