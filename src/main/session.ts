import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Runner } from '../runner'
import { builtinProviders, detectProviders } from '../runner/providers/detect'
import type { Provider } from '../runner/providers/types'
import { createCrewServer, type CrewServer } from '../server/index'
import { cloneCrew, crewHere, crewRepoUrl, publishCrew } from '../server/crewRepo'
import { GitSync } from '../server/git'
import { CrewSession } from '../server/session'
import { Store } from '../server/store'
import { makeLink, parseLink, wsUrl } from '../shared/link'
import { agentId, type AgentDef, type AgentSettings } from '../shared/llm'
import { joinPlace, projectPlace } from '../shared/places'
import { projectKey, readCrewRemote, writeCrewRemote, type CrewHome } from '../shared/project'
import type { CurrentSession, OpenOptions } from '../shared/session'
import type {
  RepoActionResult,
  RepoChange,
  RepoCommand,
  RepoStatus,
  RepoWork
} from '../shared/repository'
import { AgentStore } from './agents-store'
import type { SavedSession } from './saved-session'
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

export function isGitRepo(repoPath: string): Promise<boolean> {
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
  private crewGit: GitSync | null = null
  private agentsPath: string | null = null
  private sessionPath: string | null = null
  private projectsPath: string | null = null
  private live: CurrentSession | null = null
  private folder: string | null = null
  private place: string | null = null
  private written: SavedSession | null = null
  // What is being hosted here, kept so the listener can be moved between
  // loopback and the network without the session it is serving being remade.
  private hosted: {
    session: CrewSession
    folder: string
    base: string
    key: string
    name: string
    home: CrewHome
    sync: boolean
  } | null = null
  private projectAuto = false
  onTrouble: (message: string) => void = () => {}

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

  key(): string | null {
    return this.place
  }

  saved(): SavedSession | null {
    return this.written
  }

  async repoStatus(): Promise<RepoStatus> {
    if (!this.git) {
      return { available: false, remote: false, branch: '', changed: 0, ahead: 0, behind: 0, stashes: 0 }
    }
    return this.git.status()
  }

  async repoChanges(): Promise<RepoChange[]> {
    if (!this.git) return []
    return this.git.changes()
  }

  async repoWork(): Promise<RepoWork> {
    if (!this.git) return { status: await this.repoStatus(), changes: [], stashes: [] }
    return this.git.work()
  }

  async runRepo(command: RepoCommand): Promise<RepoActionResult> {
    if (this.git) return this.git.run(command)
    return {
      ok: false,
      updated: false,
      message: 'Open a project first.',
      status: await this.repoStatus()
    }
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
    const remote = await readCrewRemote(repoPath)
    const home = opts.home ?? known?.home ?? (remote ? 'private' : tracked ? 'folder' : 'private')
    const shared = opts.share ?? known?.shared ?? home === 'folder'
    const projectSync = opts.sync ?? known?.sync ?? home === 'folder'
    const key = known?.key || (await projectKey(repoPath))
    const base = home === 'folder' ? repoPath : path.join(this.projectsDir(), key)
    if (home === 'private' && remote && !opts.own && !crewHere(base)) {
      const got = await cloneCrew(remote, base)
      if (!got.ok) throw new Error(got.message)
    }
    const store = new Store(base)
    const session = new CrewSession(store)
    // Git is there for Push and Pull in any project that has it, because that
    // is somebody's own code and their own button. Only a crew that lives in
    // the folder runs the loop, so a project kept on this machine is never
    // committed to under anyone.
    const git = tracked ? new GitSync(repoPath) : null
    const auto = git !== null && projectSync
    if (git) git.onLog = line => console.warn('[git]', line)
    if (git && auto) git.start(AUTO_SYNC_MS)
    const crewUrl = home === 'private' ? await crewRepoUrl(base) : null
    const crew = crewUrl ? this.crewLoop(base) : null
    session.onSyncNeeded = () => this.scheduleSync()
    const server = await this.listen(session, shared, PREFERRED_PORT)
    this.server = server
    this.git = git
    this.crewGit = crew
    this.projectAuto = auto
    this.hosted = { session, folder: repoPath, base, key, name, home, sync: projectSync }
    const detected = await detectProviders()
    // The runner knows every builtin provider so an agent created right after a
    // mid-session CLI install can run.
    this.runner = new Runner({
      name,
      code: session.code,
      repoPath,
      crewBase: base,
      providers: builtinProviders,
      agents: this.agentDefs(detected, name),
      onBeforeRun: () => this.syncAll(),
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
      synced: auto || crew !== null,
      hosting: true,
      crewRemote: crewUrl,
      tracked,
      projectSync: auto
    }
    this.folder = repoPath
    this.place = projectPlace(repoPath)
    this.keep({ mode: 'host', folder: repoPath, name, home, shared })
    this.rememberProject()
    return this.live
  }

  private keep(session: SavedSession): void {
    this.written = session
    this.savedStore()?.save(session)
  }

  private syncAll(): Promise<void> {
    const passes: Array<Promise<unknown>> = []
    if (this.git && this.projectAuto) passes.push(this.git.syncNow())
    if (this.crewGit) passes.push(this.crewGit.syncNow())
    return Promise.all(passes).then(() => undefined)
  }

  private scheduleSync(): void {
    if (this.git && this.projectAuto) this.git.schedule()
    this.crewGit?.schedule()
  }

  async setProjectSync(on: boolean): Promise<CurrentSession | null> {
    const hosted = this.hosted
    const live = this.live
    const git = this.git
    if (!hosted || !live || !git || this.projectAuto === on) return this.live
    this.projectAuto = on
    if (on) {
      git.start(AUTO_SYNC_MS)
    } else {
      git.stop()
      await git.quiet()
    }
    this.live = { ...live, projectSync: on, synced: on || this.crewGit !== null }
    this.hosted = { ...hosted, sync: on }
    this.rememberProject()
    return this.live
  }

  // A project keeps the answers it was given, so opening it again from the list
  // is never a switch somebody has to set a second time.
  private rememberProject(): void {
    const hosted = this.hosted
    const live = this.live
    if (!hosted || !live) return
    this.savedStore()?.remember({
      folder: hosted.folder,
      name: hosted.name,
      home: hosted.home,
      key: hosted.key,
      sync: hosted.sync,
      shared: live.shared,
      openedAt: Date.now()
    })
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
    this.keep({
      mode: 'host',
      folder: hosted.folder,
      name: hosted.name,
      home: hosted.home,
      shared
    })
    this.rememberProject()
    return this.live
  }

  private crewLoop(base: string): GitSync {
    const crew = new GitSync(base)
    crew.onLog = line => console.warn('[crew]', line)
    crew.onTrouble = () => this.onTrouble('This crew is only saving on this computer.')
    crew.start(AUTO_SYNC_MS)
    return crew
  }

  async connectCrew(remote: string): Promise<{ ok: boolean; message: string }> {
    const hosted = this.hosted
    const live = this.live
    if (!hosted || !live) return { ok: false, message: 'Open a project first.' }
    if (hosted.home !== 'private') {
      return { ok: false, message: 'This crew lives in the project, so it already goes out with it.' }
    }
    if (this.crewGit) return { ok: false, message: 'This crew already has a repo of its own.' }
    const done = await publishCrew(hosted.base, remote)
    if (!done.ok) return { ok: false, message: done.message }
    await writeCrewRemote(hosted.folder, done.address).catch(() => {})
    this.crewGit = this.crewLoop(hosted.base)
    this.live = { ...live, synced: true, crewRemote: done.address }
    return { ok: true, message: '' }
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
      crewBase: crewHere(repoPath) ? repoPath : null,
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
      hosting: false,
      crewRemote: null,
      tracked: true,
      projectSync: true
    }
    const link = makeLink(target.host, target.port, target.code)
    this.folder = repoPath
    this.place = joinPlace(link)
    this.keep({ mode: 'join', folder: repoPath, name, link })
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
    this.place = null
    this.written = null
    this.hosted = null
    this.projectAuto = false
    this.runner?.close()
    this.runner = null
    const git = this.git
    const crew = this.crewGit
    git?.stop()
    crew?.stop()
    this.git = null
    this.crewGit = null
    await git?.quiet()
    await crew?.quiet()
    await this.server?.close()
    this.server = null
  }
}
