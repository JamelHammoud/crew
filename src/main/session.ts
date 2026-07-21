import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Runner } from '../runner'
import { builtinProviders, detectProviders } from '../runner/providers/detect'
import { installCommand, runInstall } from '../runner/providers/install'
import type { Provider } from '../runner/providers/types'
import { createCrewServer, type CrewServer } from '../server/index'
import { GitSync } from '../server/git'
import { CrewSession } from '../server/session'
import { Store } from '../server/store'
import { makeLink, parseLink, wsUrl } from '../shared/link'
import type { AgentDef, AgentSettings, ProviderCapability } from '../shared/llm'
import { AgentStore } from './agents-store'
import { SavedSessionStore } from './saved-session'

export interface HostInfo {
  link: string
  wsUrl: string
}

export interface JoinInfo {
  wsUrl: string
}

export interface CurrentSession {
  wsUrl: string
  name: string
  code: string
  link: string | null
}

export interface NewAgent {
  provider: string
  name: string
  settings: AgentSettings
}

function isGitRepo(repoPath: string): Promise<boolean> {
  if (!existsSync(path.join(repoPath, '.git'))) return Promise.resolve(false)
  return new Promise(resolve => {
    execFile('git', ['rev-parse', '--is-inside-work-tree'], { cwd: repoPath }, (error, stdout) => {
      resolve(!error && stdout.trim() === 'true')
    })
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
const AUTO_PULL_MS = 15000

export class AppSession {
  private server: CrewServer | null = null
  private runner: Runner | null = null
  private git: GitSync | null = null
  private agentsPath: string | null = null
  private sessionPath: string | null = null
  private live: CurrentSession | null = null

  constructor(paths: { agents?: string; session?: string } = {}) {
    this.agentsPath = paths.agents ?? null
    this.sessionPath = paths.session ?? null
  }

  setAgentsPath(path: string): void {
    this.agentsPath = path
  }

  setSessionPath(path: string): void {
    this.sessionPath = path
  }

  current(): CurrentSession | null {
    return this.live
  }

  async resume(): Promise<CurrentSession | null> {
    if (this.live) return this.live
    const saved = this.savedStore()?.load()
    if (!saved) return null
    try {
      if (saved.mode === 'host') await this.startHost(saved.folder, saved.name)
      else await this.startJoin(saved.link, saved.folder, saved.name)
    } catch {
      return null
    }
    return this.live
  }

  // Every builtin provider is listed, installed or not, so the UI can offer a
  // one-click install for the ones that are missing.
  async capabilities(): Promise<ProviderCapability[]> {
    return Promise.all(
      builtinProviders.map(async p => ({
        provider: p.name,
        label: p.label,
        fields: p.fields(),
        installed: await p.detect(),
        installable: installCommand(p) !== null
      }))
    )
  }

  async installProvider(name: string): Promise<ProviderCapability[]> {
    const provider = builtinProviders.find(p => p.name === name)
    if (!provider) throw new Error(`Unknown provider: ${name}`)
    await runInstall(provider)
    if (!(await provider.detect())) {
      throw new Error(`The ${provider.label} installer finished, but its CLI still was not found.`)
    }
    return this.capabilities()
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

  // An adopted agent came back from the server's memory; persist it so the
  // next launch registers it directly instead of re-adopting.
  private saveAdopted(def: AgentDef): void {
    const store = this.agentStore()
    if (!store) return
    const defs = store.load()
    if (defs.some(d => d.instanceId === def.instanceId)) return
    defs.push(def)
    store.save(defs)
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
    const detected = await detectProviders()
    // The runner knows every builtin provider so an agent created right after a
    // mid-session CLI install can run; defaults are only seeded for detected CLIs.
    this.runner = new Runner({
      name,
      code: session.code,
      repoPath,
      providers: builtinProviders,
      agents: this.agentDefs(detected),
      onAdopt: def => this.saveAdopted(def)
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
    const detected = await detectProviders()
    this.runner = new Runner({
      name,
      code: target.code,
      repoPath,
      providers: builtinProviders,
      agents: this.agentDefs(detected),
      autoPullMs: AUTO_PULL_MS,
      onAdopt: def => this.saveAdopted(def)
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
