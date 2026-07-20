import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { Runner } from '../runner'
import { detectProviders } from '../runner/providers/detect'
import type { Provider } from '../runner/providers/types'
import { createCrewServer, type CrewServer } from '../server/index'
import { GitSync } from '../server/git'
import { CrewSession } from '../server/session'
import { Store } from '../server/store'
import { makeLink, parseLink, wsUrl } from '../shared/link'
import type { AgentDef, AgentSettings, ProviderCapability } from '../shared/llm'
import { AgentStore } from './agents-store'

export interface HostInfo {
  link: string
  wsUrl: string
}

export interface JoinInfo {
  wsUrl: string
}

export interface NewAgent {
  provider: string
  name: string
  settings: AgentSettings
}

function isGitRepo(repoPath: string): Promise<boolean> {
  return new Promise(resolve => {
    execFile('git', ['rev-parse', '--git-dir'], { cwd: repoPath }, error => resolve(!error))
  })
}

function lanAddress(): string {
  for (const faces of Object.values(os.networkInterfaces())) {
    for (const face of faces ?? []) {
      if (face.family === 'IPv4' && !face.internal) return face.address
    }
  }
  return '127.0.0.1'
}

const PREFERRED_PORT = 2739

export class AppSession {
  private server: CrewServer | null = null
  private runner: Runner | null = null
  private git: GitSync | null = null
  private agentsPath: string | null = null

  constructor(agentsPath?: string) {
    this.agentsPath = agentsPath ?? null
  }

  setAgentsPath(path: string): void {
    this.agentsPath = path
  }

  async capabilities(): Promise<ProviderCapability[]> {
    const providers = await detectProviders()
    return providers.map(p => ({ provider: p.name, label: p.label, fields: p.fields() }))
  }

  createAgent(input: NewAgent): AgentDef {
    const store = this.agentStore()
    const def: AgentDef = {
      instanceId: randomUUID(),
      provider: input.provider,
      name: input.name.trim() || input.provider,
      settings: input.settings ?? {}
    }
    if (store) {
      const defs = store.load()
      defs.push(def)
      store.save(defs)
    }
    this.runner?.addAgent(def)
    return def
  }

  removeAgent(instanceId: string): void {
    const store = this.agentStore()
    if (store) store.save(store.load().filter(d => d.instanceId !== instanceId))
    this.runner?.removeAgent(instanceId)
  }

  private agentStore(): AgentStore | null {
    return this.agentsPath ? new AgentStore(this.agentsPath) : null
  }

  private agentDefs(providers: Provider[]): AgentDef[] {
    const store = this.agentStore()
    let defs = store ? store.load() : []
    if (defs.length === 0) {
      defs = providers.map(p => ({ instanceId: p.name, provider: p.name, name: p.label, settings: {} }))
      store?.save(defs)
    }
    return defs.filter(def => providers.some(p => p.name === def.provider))
  }

  async startHost(repoPath: string, name: string): Promise<HostInfo> {
    await this.leave()
    if (!(await isGitRepo(repoPath))) {
      throw new Error('That folder is not a git repository. Pick a folder that is tracked with git.')
    }
    const store = new Store(repoPath)
    const session = new CrewSession(store)
    const git = new GitSync(repoPath)
    git.onLog = line => console.warn('[git]', line)
    session.onSyncNeeded = () => git.schedule()
    let server: CrewServer
    try {
      server = await createCrewServer(session, { port: PREFERRED_PORT })
    } catch {
      server = await createCrewServer(session, { port: 0 })
    }
    this.server = server
    this.git = git
    const providers = await detectProviders()
    this.runner = new Runner({
      name,
      code: session.code,
      repoPath,
      providers,
      agents: this.agentDefs(providers)
    })
    this.runner.connect(`ws://127.0.0.1:${server.port()}/ws`)
    return {
      link: makeLink(lanAddress(), server.port(), session.code),
      wsUrl: `ws://127.0.0.1:${server.port()}/ws`
    }
  }

  async startJoin(linkRaw: string, repoPath: string, name: string): Promise<JoinInfo> {
    await this.leave()
    const target = parseLink(linkRaw)
    const providers = await detectProviders()
    this.runner = new Runner({
      name,
      code: target.code,
      repoPath,
      providers,
      agents: this.agentDefs(providers)
    })
    this.runner.connect(wsUrl(target))
    return { wsUrl: wsUrl(target) }
  }

  async leave(): Promise<void> {
    this.runner?.close()
    this.runner = null
    this.git?.stop()
    this.git = null
    await this.server?.close()
    this.server = null
  }
}
