import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { watch, type FSWatcher } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { IosDevice, IosOutput } from '../shared/ios'
import { iosIssuesIn, watchedFile, type IosFrame, type IosLiveState } from '../shared/iosLive'
import { newestRuntime, runtimeNumber, type IosSetup } from '../shared/iosSetup'
import { command, jsonFrom, prettyCommand, xcodeEnv } from './ios-command'
import { containerArgs, iosProjectIn, simulatorDevices } from './ios-development'
import { projectContainers } from '../shared/iosProject'
import { IosFrames } from './ios-frames'
import { createIosProject } from './ios-project-template'
import { iosBuildLog, iosWorkDir } from '../shared/iosAgent'
import { readIosSetup } from './ios-setup'

export interface IosLiveHooks {
  state(state: IosLiveState): void
  output(output: IosOutput): void
  frame(frame: IosFrame): void
}

export interface IosStartRequest {
  name?: string
  projectPath?: string
  deviceId?: string
}

const SETTLE = 600
const BUILD_TIMEOUT = 20 * 60_000
const OUTPUT_KEPT = 400_000

function blank(folder: string): IosLiveState {
  return {
    phase: 'off',
    folder,
    project: '',
    scheme: '',
    bundleId: '',
    device: null,
    message: '',
    issues: [],
    builds: 0,
    builtAt: 0,
    setup: null
  }
}

function projectName(folder: string): string {
  const raw = path.basename(path.resolve(folder)).replace(/[^A-Za-z0-9]+/g, ' ')
  const words = raw.split(' ').filter(Boolean)
  const name = words.map(word => word[0].toUpperCase() + word.slice(1)).join('')
  return /^[A-Za-z]/.test(name) ? name : `App${name}`
}

function bundleFor(name: string): string {
  return `com.crew.${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
}

function pickDevice(devices: IosDevice[]): IosDevice | null {
  const newest = newestRuntime(devices.map(device => device.os))
  const onNewest = devices.filter(device => device.os === newest)
  const pool = onNewest.length > 0 ? onNewest : devices
  return (
    pool.find(device => /^iPhone \d/.test(device.name)) ??
    pool.find(device => /iPhone/.test(device.name)) ??
    pool[0] ??
    null
  )
}

class Session {
  state: IosLiveState
  child: ChildProcessWithoutNullStreams | null = null
  running: ChildProcessWithoutNullStreams | null = null
  watcher: FSWatcher | null = null
  settle: NodeJS.Timeout | null = null
  frames: IosFrames
  stopped = false
  building = false
  again = false

  constructor(
    key: string,
    folder: string,
    readonly hooks: IosLiveHooks
  ) {
    this.state = blank(folder)
    this.frames = new IosFrames(key, frame => {
      if (!this.stopped) hooks.frame(frame)
    })
  }

  say(patch: Partial<IosLiveState>): void {
    this.state = { ...this.state, ...patch }
    if (!this.stopped) this.hooks.state(this.state)
  }

  write(stream: IosOutput['stream'], text: string): void {
    if (!this.stopped) this.hooks.output({ runId: 'ios', stream, text, ts: Date.now() })
  }
}

function stopChild(child: ChildProcessWithoutNullStreams | null): void {
  if (!child || child.killed) return
  try {
    if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM')
    else child.kill()
  } catch {
    child.kill()
  }
}

export class IosLive {
  private sessions = new Map<number, Session>()

  stateFor(senderId: number, folder: string): IosLiveState {
    return this.sessions.get(senderId)?.state ?? blank(folder)
  }

  async start(senderId: number, folder: string, request: IosStartRequest, hooks: IosLiveHooks): Promise<IosLiveState> {
    this.close(senderId)
    const session = new Session(String(senderId), folder, hooks)
    this.sessions.set(senderId, session)

    const setup = await readIosSetup()
    session.say({ setup })
    if (!setup.ready) {
      session.say({ phase: 'setup' })
      return session.state
    }

    const env = xcodeEnv()
    const project = await this.project(session, folder, request)
    if (!project) return session.state
    const scheme = await this.scheme(project, env)
    if (!scheme) {
      session.say({ phase: 'failed', message: 'That project has no scheme to run.' })
      return session.state
    }

    const devices = await simulatorDevices(env)
    const wanted = request.deviceId ? devices.find(device => device.id === request.deviceId) : null
    const device = wanted ?? pickDevice(devices)
    if (!device) {
      session.say({ phase: 'failed', message: 'No iOS simulator is installed on this Mac.' })
      return session.state
    }

    session.say({
      phase: 'booting',
      project,
      scheme,
      message: '',
      device: { id: device.id, name: device.name, os: device.os }
    })
    await command('/usr/bin/xcrun', ['simctl', 'boot', device.id], { env, timeout: 30_000 })
    await command('/usr/bin/xcrun', ['simctl', 'bootstatus', device.id, '-b'], { env, timeout: 180_000 })
    if (session.stopped) return session.state

    session.frames.start(device.id, env)
    this.watch(session, folder)
    await this.cycle(senderId)
    return this.stateFor(senderId, folder)
  }

  async rebuild(senderId: number): Promise<void> {
    const session = this.sessions.get(senderId)
    if (!session || session.state.phase === 'setup' || session.state.phase === 'off') return
    await this.cycle(senderId)
  }

  devices(): Promise<IosDevice[]> {
    return simulatorDevices(xcodeEnv())
  }

  setup(): Promise<IosSetup> {
    return readIosSetup()
  }

  close(senderId: number): void {
    const session = this.sessions.get(senderId)
    if (!session) return
    session.stopped = true
    if (session.settle) clearTimeout(session.settle)
    session.watcher?.close()
    session.frames.stop()
    stopChild(session.child)
    stopChild(session.running)
    this.sessions.delete(senderId)
  }

  private async project(session: Session, folder: string, request: IosStartRequest): Promise<string> {
    if (request.projectPath && iosProjectIn(folder, request.projectPath)) return request.projectPath
    const found = await this.containers(folder)
    if (found.length > 0) return found[0]
    const name = request.name?.trim() || projectName(folder)
    session.write('system', `Making ${name} in ${folder}\n`)
    const made = await createIosProject(folder, { name, bundleId: bundleFor(name) })
    if (!made.ok) {
      session.say({ phase: 'failed', message: made.message })
      return ''
    }
    return made.projectPath
  }

  private async containers(folder: string): Promise<string[]> {
    return (await projectContainers(folder)).map(found => found.path)
  }

  private async scheme(project: string, env: NodeJS.ProcessEnv): Promise<string> {
    const listed = await command('/usr/bin/xcodebuild', [...containerArgs(project), '-list', '-json'], {
      env,
      timeout: 90_000
    })
    const data = jsonFrom<{ project?: { schemes?: string[] }; workspace?: { schemes?: string[] } }>(listed.stdout)
    const schemes = data?.project?.schemes ?? data?.workspace?.schemes ?? []
    const name = path.basename(project).replace(/\.(?:xcworkspace|xcodeproj)$/, '')
    return schemes.find(scheme => scheme === name) ?? schemes[0] ?? ''
  }

  private watch(session: Session, folder: string): void {
    try {
      session.watcher = watch(folder, { recursive: true }, (_kind, file) => {
        if (!file || !watchedFile(String(file))) return
        if (session.settle) clearTimeout(session.settle)
        session.settle = setTimeout(() => {
          if (session.building) session.again = true
          else void this.cycle(this.keyOf(session))
        }, SETTLE)
      })
    } catch {
      session.watcher = null
    }
  }

  private keyOf(session: Session): number {
    for (const [id, one] of this.sessions) if (one === session) return id
    return -1
  }

  private async cycle(senderId: number): Promise<void> {
    const session = this.sessions.get(senderId)
    if (!session || session.stopped || session.building) return
    session.building = true
    try {
      do {
        session.again = false
        const done = await this.buildAndRun(session)
        if (!done) break
      } while (session.again && !session.stopped)
    } finally {
      session.building = false
    }
  }

  private async buildAndRun(session: Session): Promise<boolean> {
    const { project, scheme, device } = session.state
    if (!project || !scheme || !device) return false
    const env = xcodeEnv()
    session.say({ phase: 'building', message: '', issues: [] })
    const args = [
      ...containerArgs(project),
      '-scheme',
      scheme,
      '-configuration',
      'Debug',
      '-destination',
      `id=${device.id}`,
      'build'
    ]
    let kept = ''
    const built = await this.stream(session, '/usr/bin/xcodebuild', args, path.dirname(project), env, text => {
      kept = (kept + text).slice(-OUTPUT_KEPT)
    })
    if (session.stopped) return false
    await this.record(session.state.folder, built === 0, kept)
    if (built !== 0) {
      session.say({ phase: 'failed', issues: iosIssuesIn(kept), message: '' })
      return false
    }

    const settings = await this.settings(project, scheme, device.id, env)
    if (!settings.appPath || !settings.bundleId) {
      session.say({ phase: 'failed', message: 'The built app could not be found.' })
      return false
    }
    session.say({ phase: 'installing', bundleId: settings.bundleId, issues: iosIssuesIn(kept) })
    const installed = await command('/usr/bin/xcrun', ['simctl', 'install', device.id, settings.appPath], {
      env,
      timeout: 180_000
    })
    if (!installed.ok) {
      session.write('stderr', installed.stderr || installed.stdout)
      session.say({ phase: 'failed', message: 'The app could not be installed.' })
      return false
    }
    if (session.stopped) return false

    stopChild(session.running)
    session.running = null
    await command('/usr/bin/xcrun', ['simctl', 'terminate', device.id, settings.bundleId], { env, timeout: 15_000 })
    session.write('system', `Launching ${settings.bundleId}\n`)
    const child = spawn('/usr/bin/xcrun', ['simctl', 'launch', '--console-pty', device.id, settings.bundleId], {
      cwd: path.dirname(project),
      env,
      detached: process.platform !== 'win32',
      stdio: 'pipe'
    })
    session.running = child
    child.stdout.on('data', chunk => session.write('stdout', String(chunk)))
    child.stderr.on('data', chunk => session.write('stderr', String(chunk)))
    child.on('error', error => session.write('stderr', `${error.message}\n`))
    session.say({
      phase: 'running',
      builds: session.state.builds + 1,
      builtAt: Date.now(),
      message: '',
      issues: iosIssuesIn(kept)
    })
    return true
  }

  private async record(folder: string, ok: boolean, output: string): Promise<void> {
    const issues = iosIssuesIn(output)
    const head = ok ? 'Build succeeded.' : 'Build failed.'
    const lines = issues.map(issue =>
      issue.file
        ? `${issue.kind}: ${issue.file}:${issue.line}:${issue.column}: ${issue.message}`
        : `${issue.kind}: ${issue.message}`
    )
    const body = [`${head} ${new Date().toISOString()}`, '', ...lines, '', '--- xcodebuild ---', output].join('\n')
    await mkdir(iosWorkDir(folder), { recursive: true }).catch(() => undefined)
    await writeFile(iosBuildLog(folder), body).catch(() => undefined)
  }

  private stream(
    session: Session,
    file: string,
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
    keep: (text: string) => void
  ): Promise<number | null> {
    session.write('system', `$ ${prettyCommand(file, args)}\n`)
    return new Promise(resolve => {
      const child = spawn(file, args, { cwd, env, detached: process.platform !== 'win32', stdio: 'pipe' })
      session.child = child
      const timer = setTimeout(() => stopChild(child), BUILD_TIMEOUT)
      const take = (stream: IosOutput['stream']) => (chunk: unknown) => {
        const text = String(chunk)
        keep(text)
        session.write(stream, text)
      }
      child.stdout.on('data', take('stdout'))
      child.stderr.on('data', take('stderr'))
      child.on('error', error => {
        clearTimeout(timer)
        session.write('stderr', `${error.message}\n`)
        resolve(null)
      })
      child.on('close', code => {
        clearTimeout(timer)
        if (session.child === child) session.child = null
        resolve(code)
      })
    })
  }

  private async settings(
    project: string,
    scheme: string,
    deviceId: string,
    env: NodeJS.ProcessEnv
  ): Promise<{ appPath: string; bundleId: string }> {
    const found = await command(
      '/usr/bin/xcodebuild',
      [
        ...containerArgs(project),
        '-scheme',
        scheme,
        '-configuration',
        'Debug',
        '-destination',
        `id=${deviceId}`,
        '-showBuildSettings',
        '-json'
      ],
      { cwd: path.dirname(project), env, timeout: 120_000 }
    )
    const rows = jsonFrom<Array<{ buildSettings?: Record<string, string> }>>(found.stdout)
    const settings = Array.isArray(rows)
      ? rows.find(row => row.buildSettings?.['WRAPPER_NAME']?.endsWith('.app'))?.buildSettings
      : undefined
    return {
      appPath: settings ? path.join(settings['TARGET_BUILD_DIR'] ?? '', settings['WRAPPER_NAME'] ?? '') : '',
      bundleId: settings?.['PRODUCT_BUNDLE_IDENTIFIER'] ?? ''
    }
  }
}

export { pickDevice, projectName, bundleFor, runtimeNumber }
