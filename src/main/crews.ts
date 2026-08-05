import path from 'node:path'
import { builtinProviders } from '../runner/providers/detect'
import { installCommand, runInstall } from '../runner/providers/install'
import { checkServer } from '../runner/providers/local-serve'
import {
  forgetServer,
  knownServers,
  rememberServer,
  setServersPath as holdServersAt
} from '../runner/providers/local-servers'
import { crewHere } from '../server/crewRepo'
import type { ProviderCapability } from '../shared/llm'
import { serverUrl, type ModelServer } from '../shared/modelServers'
import { projectPlace, type LivePlace } from '../shared/places'
import { projectKey, readCrewRemote } from '../shared/project'
import type { RecentJoin, RecentProject } from '../shared/recent'
import type { CurrentSession, OpenOptions, ProjectPlan } from '../shared/session'
import { Doors } from './doors'
import { SavedSessionStore } from './saved-session'
import { AppSession, isGitRepo } from './session'

export class Crews {
  private open = new Map<string, AppSession>()
  private view = new Map<number, string>()
  // Every crew this app opens stands behind the same pair of doors, which is
  // what keeps a guest's link good when somebody opens another project.
  private doors = new Doors()
  private agentsPath: string | null = null
  private sessionPath: string | null = null
  private projectsPath: string | null = null
  private idle = new AppSession()
  private queue: Promise<void> = Promise.resolve()
  onTrouble: (message: string) => void = () => {}
  onLive: (places: LivePlace[]) => void = () => {}

  setAgentsPath(at: string): void {
    this.agentsPath = at
  }

  setSessionPath(at: string): void {
    this.sessionPath = at
  }

  setProjectsPath(at: string): void {
    this.projectsPath = at
  }

  setServersPath(at: string): void {
    holdServersAt(at)
  }

  places(): LivePlace[] {
    const live: LivePlace[] = []
    for (const [key, session] of this.open) {
      const current = session.current()
      if (current) {
        live.push({
          key,
          folder: current.folder,
          name: current.name,
          hosting: current.hosting,
          threads: session.liveThreads()
        })
      }
    }
    return live
  }

  any(): boolean {
    return this.places().length > 0
  }

  openKeys(): string[] {
    const keys: string[] = []
    for (const [key, session] of this.open) if (session.current()) keys.push(key)
    return keys
  }

  inView(id: number): AppSession {
    const key = this.view.get(id)
    return (key ? this.open.get(key) : null) ?? this.idle
  }

  folderInView(id: number): string | null {
    return this.inView(id).projectFolder()
  }

  keyInView(id: number): string | null {
    return this.view.get(id) ?? null
  }

  current(id: number): CurrentSession | null {
    const held = this.view.get(id)
    if (held) return this.open.get(held)?.current() ?? null
    const [first] = this.open.keys()
    if (!first) return null
    this.look(id, first)
    return this.open.get(first)?.current() ?? null
  }

  async start(id: number, folder: string, name: string, opts: OpenOptions = {}): Promise<CurrentSession> {
    return this.inTurn(async () => {
      const standing = this.standing(projectPlace(folder))
      if (standing) {
        this.look(id, standing.key)
        return standing.current
      }
      const session = this.make()
      const current = await session.startHost(folder, name, opts)
      this.hold(id, session)
      return current
    })
  }

  async join(id: number, link: string, folder: string, name: string): Promise<CurrentSession> {
    const session = this.make()
    const current = await session.startJoin(link, folder, name)
    const key = session.key()
    const standing = key ? this.standing(key) : null
    if (standing) {
      await session.shutdown()
      this.look(id, standing.key)
      return standing.current
    }
    this.hold(id, session)
    return current
  }

  switchTo(id: number, key: string): CurrentSession | null {
    const current = this.open.get(key)?.current()
    if (!current) return null
    this.look(id, key)
    return current
  }

  rename(id: number, name: string): CurrentSession | null {
    const current = this.inView(id).rename(name)
    if (current) this.onLive(this.places())
    return current
  }

  async close(key: string): Promise<void> {
    const session = this.open.get(key)
    if (!session) return
    this.open.delete(key)
    for (const [id, at] of [...this.view]) if (at === key) this.view.delete(id)
    await session.shutdown()
    this.onLive(this.places())
  }

  async leave(id: number): Promise<void> {
    const key = this.view.get(id)
    if (!key) return
    const session = this.open.get(key)
    this.open.delete(key)
    this.view.delete(id)
    await session?.leave()
    this.onLive(this.places())
  }

  async resume(): Promise<void> {
    if (this.open.size > 0) return
    const saved = this.store()?.load()
    if (!saved) return
    const session = this.make()
    try {
      if (saved.mode === 'host') {
        await session.startHost(saved.folder, saved.name, { home: saved.home, share: saved.shared })
      } else {
        await session.startJoin(saved.link, saved.folder, saved.name)
      }
    } catch {
      return
    }
    const key = session.key()
    if (!key) return
    this.open.set(key, session)
    this.onLive(this.places())
  }

  forget(id: number): void {
    this.view.delete(id)
  }

  async shutdownAll(): Promise<void> {
    const held = [...this.open.values()]
    this.open.clear()
    this.view.clear()
    await Promise.all(held.map(session => session.shutdown()))
    await this.doors.shutdown()
  }

  recentProjects(): RecentProject[] {
    return this.store()?.projects() ?? []
  }

  recentJoins(): RecentJoin[] {
    return this.store()?.recentJoins() ?? []
  }

  forgetProject(folder: string): void {
    this.store()?.forget(folder)
  }

  forgetJoin(link: string): void {
    this.store()?.forgetJoin(link)
  }

  async projectPlan(folder: string): Promise<ProjectPlan> {
    const tracked = await isGitRepo(folder)
    const known = this.recentProjects().find(project => project.folder === folder) ?? null
    const crewRemote = await readCrewRemote(folder)
    const key = known?.key || (await projectKey(folder))
    return {
      home: known?.home ?? (crewRemote ? 'private' : tracked ? 'folder' : 'private'),
      tracked,
      known: known !== null || crewRemote !== null,
      crewRemote,
      crewHere: this.projectsPath ? crewHere(path.join(this.projectsPath, key)) : false
    }
  }

  async capabilities(): Promise<ProviderCapability[]> {
    return Promise.all(
      builtinProviders.map(async p => {
        // What detect() finds is what fields() draws from, so the picker is
        // built after the looking rather than beside it. Read together, a
        // model list warmed by detect lands a beat too late to be in it.
        const installed = await p.detect()
        return {
          provider: p.name,
          label: p.label,
          fields: p.fields(),
          installed,
          installable: installCommand(p) !== null,
          note: await p.note?.()
        }
      })
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

  modelServers(): ModelServer[] {
    return knownServers().map(({ url }) => ({ url }))
  }

  async addModelServer(input: { url: string; key?: string }): Promise<ProviderCapability[]> {
    const url = serverUrl(input.url)
    if (!url) throw new Error('That is not an address.')
    const answer = await checkServer({ url, key: input.key })
    if (!answer.ok) throw new Error(answer.why)
    rememberServer({ url, key: input.key })
    return this.capabilities()
  }

  async forgetModelServer(url: string): Promise<ProviderCapability[]> {
    forgetServer(url)
    return this.capabilities()
  }

  private inTurn<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work)
    this.queue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  private standing(key: string): { key: string; current: CurrentSession } | null {
    const current = this.open.get(key)?.current()
    if (current) return { key, current }
    this.open.delete(key)
    return null
  }

  private hold(id: number, session: AppSession): void {
    const key = session.key()
    if (!key) return
    this.open.set(key, session)
    this.look(id, key)
    this.onLive(this.places())
  }

  private look(id: number, key: string): void {
    this.view.set(id, key)
    const saved = this.open.get(key)?.saved()
    if (saved) this.store()?.save(saved)
  }

  private make(): AppSession {
    const session = new AppSession({
      agents: this.agentsPath ?? undefined,
      session: this.sessionPath ?? undefined,
      projects: this.projectsPath ?? undefined,
      doors: this.doors
    })
    session.onTrouble = message => this.onTrouble(message)
    session.onThreadsChanged = () => this.onLive(this.places())
    return session
  }

  private store(): SavedSessionStore | null {
    return this.sessionPath ? new SavedSessionStore(this.sessionPath) : null
  }
}
