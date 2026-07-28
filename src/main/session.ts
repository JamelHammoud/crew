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
import { agentId, type AgentDef, type AgentSettings, type ProviderCapability } from '../shared/llm'
import { projectKey, type CrewHome } from '../shared/project'
import type { CurrentSession, OpenOptions, ProjectPlan } from '../shared/session'
import type { RepoActionResult, RepoChange, RepoStatus } from '../shared/repository'
import type { RecentJoin, RecentProject } from '../shared/recent'
import { AgentStore } from './agents-store'
import {
  absolutePathOf,
  listRepoFiles,
  readLocalFile,
  readRepoFile,
  repoPathOf,
  writeLocalFile,
  writeRepoFile
} from './files'
import { locatePath } from './locate'
import { SavedSessionStore } from './saved-session'
import type { PathLocation, RepoFile } from '../shared/files'

export type { CurrentSession, OpenOptions, ProjectPlan } from '../shared/session'

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
const AUTO_SYNC_MS = 5000

export class AppSession {
  private server: CrewServer | null = null
  private runner: Runner | null = null
  private git: GitSync | null = null
  private agentsPath: string | null = null
  private sessionPath: string | null = null
  private projectsPath: string | null = null
  private live: CurrentSession | null = null
  private folder: string | null = null
  // What is being hosted here, kept so the listener can be moved between
  // loopback and the network without the session it is serving being remade.
  private hosted: { session: CrewSession; folder: string; name: string; home: CrewHome } | null = null

  constructor(paths: { agents?: string; session?: string; projects?: string } = {}) {
    this.agentsPath = paths.agents ?? null
    this.sessionPath = paths.session ?? null
    this.projectsPath = paths.projects ?? null
  }

  setAgentsPath(path: string): void {
    this.agentsPath = path
  }

  setSessionPath(path: string): void {
    this.sessionPath = path
  }

  setProjectsPath(path: string): void {
    this.projectsPath = path
  }

  current(): CurrentSession | null {
    return this.live
  }

  projectFolder(): string | null {
    return this.folder
  }

  recentJoins(): RecentJoin[] {
    return this.savedStore()?.recentJoins() ?? []
  }

  recentProjects(): RecentProject[] {
    return this.savedStore()?.projects() ?? []
  }

  forgetProject(folder: string): void {
    this.savedStore()?.forget(folder)
  }

  forgetJoin(link: string): void {
    this.savedStore()?.forgetJoin(link)
  }

  async repoStatus(): Promise<RepoStatus> {
    if (!this.git) {
      return { available: false, remote: false, branch: '', changed: 0, ahead: 0, behind: 0 }
    }
    return this.git.status()
  }

  async repoChanges(): Promise<RepoChange[]> {
    if (!this.git) return []
    return this.git.changes()
  }

  async pullRepo(): Promise<RepoActionResult> {
    if (this.git) return this.git.pullNow()
    return {
      ok: false,
      updated: false,
      message: 'Open a project first.',
      status: await this.repoStatus()
    }
  }

  async pushRepo(): Promise<RepoActionResult> {
    if (this.git) return this.git.pushNow()
    return {
      ok: false,
      updated: false,
      message: 'Open a project first.',
      status: await this.repoStatus()
    }
  }

  async readFile(target: string): Promise<RepoFile | null> {
    const inRepo = this.folder ? repoPathOf(this.folder, target) : null
    if (this.folder && inRepo !== null) return readRepoFile(this.folder, inRepo)
    return readLocalFile(target)
  }

  async listFiles(): Promise<string[]> {
    return this.folder ? listRepoFiles(this.folder) : []
  }

  async writeFile(target: string, text: string): Promise<RepoFile | null> {
    const inRepo = this.folder ? repoPathOf(this.folder, target) : null
    if (this.folder && inRepo !== null) return writeRepoFile(this.folder, inRepo, text)
    return writeLocalFile(target, text)
  }

  async locatePath(target: string): Promise<PathLocation> {
    return locatePath(this.folder, target)
  }

  resolveFile(target: string): string | null {
    return absolutePathOf(this.folder, target)
  }

  async resume(): Promise<CurrentSession | null> {
    if (this.live) return this.live
    const saved = this.savedStore()?.load()
    if (!saved) return null
    try {
      if (saved.mode === 'host') {
        await this.startHost(saved.folder, saved.name, { home: saved.home, share: saved.shared })
      } else {
        await this.startJoin(saved.link, saved.folder, saved.name)
      }
    } catch {
      return null
    }
    return this.live
  }

  // What opening this folder would do, so the app only asks where a crew should
  // live the first time it is opened.
  async projectPlan(folder: string): Promise<ProjectPlan> {
    const tracked = await isGitRepo(folder)
    const known = this.savedStore()?.projects().find(project => project.folder === folder) ?? null
    return { home: known?.home ?? (tracked ? 'folder' : 'private'), tracked, known: known !== null }
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
    const instanceId = randomUUID()
    const def: AgentDef = {
      id: agentId(this.live?.name ?? '', instanceId),
      instanceId,
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
    this.forgetAgent(instanceId)
    this.runner?.removeAgent(instanceId)
  }

  private forgetAgent(instanceId: string): void {
    const store = this.agentStore()
    if (store) store.save(store.load().filter(d => d.instanceId !== instanceId))
  }

  private renameAgent(instanceId: string, name: string): void {
    const store = this.agentStore()
    if (store) store.save(store.load().map(d => (d.instanceId === instanceId ? { ...d, name } : d)))
  }

  private agentStore(): AgentStore | null {
    return this.agentsPath ? new AgentStore(this.agentsPath) : null
  }

  private savedStore(): SavedSessionStore | null {
    return this.sessionPath ? new SavedSessionStore(this.sessionPath) : null
  }

  // Agents are only ever the ones someone made here. Nothing is enrolled for
  // you because a CLI happens to be installed.
  private agentDefs(providers: Provider[], name: string): AgentDef[] {
    const defs = this.agentStore()?.identify(name) ?? []
    return defs.filter(def => providers.some(p => p.name === def.provider))
  }

  // Opening a project is one thing whichever way it is answered. A crew that
  // lives in the folder syncs and stands on the network, one kept on this
  // machine writes nothing into the project, commits nothing of its own, and is
  // served on loopback until sharing is turned on.
  async startHost(repoPath: string, name: string, opts: OpenOptions = {}): Promise<CurrentSession> {
    await this.stop()
    const tracked = await isGitRepo(repoPath)
    const known = this.savedStore()?.projects().find(project => project.folder === repoPath)
    const home = opts.home ?? known?.home ?? (tracked ? 'folder' : 'private')
    const shared = opts.share ?? home === 'folder'
    const key = known?.key || (await projectKey(repoPath))
    const base = home === 'folder' ? repoPath : path.join(this.projectsDir(), key)
    const store = new Store(base)
    const session = new CrewSession(store)
    // Git is there for Push and Pull in any project that has it, because that
    // is somebody's own code and their own button. Only a crew that lives in
    // the folder runs the loop, so a project kept on this machine is never
    // committed to under anyone.
    const git = tracked ? new GitSync(repoPath) : null
    const auto = git !== null && home === 'folder'
    if (git) git.onLog = line => console.warn('[git]', line)
    if (git && auto) {
      session.onSyncNeeded = () => git.schedule()
      git.start(AUTO_SYNC_MS)
    }
    const server = await this.listen(session, shared, PREFERRED_PORT)
    this.server = server
    this.git = git
    this.hosted = { session, folder: repoPath, name, home }
    const detected = await detectProviders()
    // The runner knows every builtin provider so an agent created right after a
    // mid-session CLI install can run.
    this.runner = new Runner({
      name,
      code: session.code,
      repoPath,
      providers: builtinProviders,
      agents: this.agentDefs(detected, name),
      onBeforeRun: git && auto ? () => git.syncNow() : undefined,
      onForget: instanceId => this.forgetAgent(instanceId),
      onRename: (instanceId, agentName) => this.renameAgent(instanceId, agentName)
    })
    const url = `ws://127.0.0.1:${server.port()}/ws`
    this.runner.connect(url)
    this.live = {
      wsUrl: url,
      name,
      code: session.code,
      link: shared ? makeLink(lanAddress(), server.port(), session.code) : null,
      folder: repoPath,
      home,
      shared,
      synced: auto,
      hosting: true
    }
    this.folder = repoPath
    this.savedStore()?.save({ mode: 'host', folder: repoPath, name, home, shared })
    this.savedStore()?.remember({ folder: repoPath, name, home, key, openedAt: Date.now() })
    return this.live
  }

  // Inviting people is the listener moving, and nothing else. The session, its
  // code and everything in it stay where they are, so the only thing anyone
  // here sees is their own socket coming back a moment later.
  async setShared(shared: boolean): Promise<CurrentSession | null> {
    const hosted = this.hosted
    const live = this.live
    if (!hosted || !live || !this.server || live.shared === shared) return this.live
    const held = this.server
    this.server = null
    await held.close()
    this.server = await this.listen(hosted.session, shared, held.port())
    const port = this.server.port()
    const url = `ws://127.0.0.1:${port}/ws`
    this.live = {
      ...live,
      wsUrl: url,
      shared,
      link: shared ? makeLink(lanAddress(), port, hosted.session.code) : null
    }
    if (url !== live.wsUrl) this.runner?.connect(url)
    this.savedStore()?.save({
      mode: 'host',
      folder: hosted.folder,
      name: hosted.name,
      home: hosted.home,
      shared
    })
    return this.live
  }

  private listen(session: CrewSession, shared: boolean, port: number): Promise<CrewServer> {
    const host = shared ? '0.0.0.0' : '127.0.0.1'
    return createCrewServer(session, { port, host }).catch(() => createCrewServer(session, { port: 0, host }))
  }

  private projectsDir(): string {
    if (!this.projectsPath) throw new Error('There is nowhere on this machine to keep a crew.')
    return this.projectsPath
  }

  async startJoin(linkRaw: string, repoPath: string, name: string): Promise<CurrentSession> {
    await this.stop()
    const target = parseLink(linkRaw)
    const detected = await detectProviders()
    const git = new GitSync(repoPath)
    git.onLog = line => console.warn('[git]', line)
    this.git = git
    git.start(AUTO_SYNC_MS)
    this.runner = new Runner({
      name,
      code: target.code,
      repoPath,
      providers: builtinProviders,
      agents: this.agentDefs(detected, name),
      onBeforeRun: () => git.syncNow(),
      onForget: instanceId => this.forgetAgent(instanceId),
      onRename: (instanceId, agentName) => this.renameAgent(instanceId, agentName)
    })
    const url = wsUrl(target)
    this.runner.connect(url)
    this.live = {
      wsUrl: url,
      name,
      code: target.code,
      link: null,
      folder: repoPath,
      home: 'folder',
      shared: true,
      synced: true,
      hosting: false
    }
    this.folder = repoPath
    this.savedStore()?.save({
      mode: 'join',
      folder: repoPath,
      name,
      link: makeLink(target.host, target.port, target.code)
    })
    return this.live
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
    this.hosted = null
    this.runner?.close()
    this.runner = null
    this.git?.stop()
    this.git = null
    await this.server?.close()
    this.server = null
  }
}
