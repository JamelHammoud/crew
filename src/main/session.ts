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
import { readRepoFile, resolveRepoPath, statRepoFile, writeRepoFile } from './files'
import { SavedSessionStore } from './saved-session'
import type { RepoFile, RepoPathKind } from '../shared/files'

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
  private folder: string | null = null

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

  async readFile(target: string): Promise<RepoFile | null> {
    if (!this.folder) return null
    return readRepoFile(this.folder, target)
  }

  async writeFile(target: string, text: string): Promise<RepoFile | null> {
    if (!this.folder) return null
    return writeRepoFile(this.folder, target, text)
  }

  resolveFile(target: string): string | null {
    if (!this.folder) return null
    return resolveRepoPath(this.folder, target)
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

  private savedStore(): SavedSessionStore | null {
    return this.sessionPath ? new SavedSessionStore(this.sessionPath) : null
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
    await this.stop()
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
    const url = `ws://127.0.0.1:${server.port()}/ws`
    this.runner.connect(url)
    const link = makeLink(lanAddress(), server.port(), session.code)
    this.live = { wsUrl: url, name, code: session.code, link }
    this.folder = repoPath
    this.savedStore()?.save({ mode: 'host', folder: repoPath, name })
    return { link, wsUrl: url }
  }

  async startJoin(linkRaw: string, repoPath: string, name: string): Promise<JoinInfo> {
    await this.stop()
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
    const url = wsUrl(target)
    this.runner.connect(url)
    this.live = { wsUrl: url, name, code: target.code, link: null }
    this.folder = repoPath
    this.savedStore()?.save({
      mode: 'join',
      folder: repoPath,
      name,
      link: makeLink(target.host, target.port, target.code)
    })
    return { wsUrl: url }
  }

  // Quitting the app keeps the saved session so the next launch rejoins it.
  // Only an explicit leave forgets it.
  async leave(): Promise<void> {
    await this.stop()
    this.savedStore()?.clear()
  }

  async shutdown(): Promise<void> {
    await this.stop()
  }

  private async stop(): Promise<void> {
    this.live = null
    this.folder = null
    this.runner?.close()
    this.runner = null
    this.git?.stop()
    this.git = null
    await this.server?.close()
    this.server = null
  }
}
