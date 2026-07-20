import { execFile } from 'node:child_process'
import os from 'node:os'
import { Runner } from '../runner'
import { detectProviders } from '../runner/providers/detect'
import { createCrewServer, type CrewServer } from '../server/index'
import { GitSync } from '../server/git'
import { CrewSession } from '../server/session'
import { Store } from '../server/store'
import { makeLink, parseLink, wsUrl } from '../shared/link'

export interface HostInfo {
  link: string
  wsUrl: string
}

export interface JoinInfo {
  wsUrl: string
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
      providers
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
      providers
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
