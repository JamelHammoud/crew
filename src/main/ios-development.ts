import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { access, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type {
  IosDevice,
  IosCreateRequest,
  IosCreateResult,
  IosEnvironment,
  IosOutput,
  IosProject,
  IosRunRequest,
  IosRunResult,
  IosScreenshot,
  IosXcode
} from '../shared/ios'
import { createIosProject } from './ios-project-template'
import { command, developerDir, jsonFrom, prettyCommand, xcodeEnv } from './ios-command'
import { hasIosProject, projectContainers } from '../shared/iosProject'

type ActiveRun = {
  request: IosRunRequest
  child: ChildProcessWithoutNullStreams | null
  cancelled: boolean
  bundleId: string
  simulator: boolean
}

export function containerArgs(projectPath: string): string[] {
  return projectPath.endsWith('.xcworkspace') ? ['-workspace', projectPath] : ['-project', projectPath]
}

export function iosBuildArguments(request: IosRunRequest): string[] {
  const args = [...containerArgs(request.projectPath), '-scheme', request.scheme, '-configuration', 'Debug']
  if (request.deviceId) args.push('-destination', `id=${request.deviceId}`)
  else args.push('-destination', 'generic/platform=iOS Simulator')
  if (request.action === 'test') args.push('test')
  else if (request.action === 'clean') args.push('clean', 'build')
  else args.push('build')
  return args
}

export function iosProjectIn(folder: string, projectPath: string): boolean {
  const root = path.resolve(folder)
  const target = path.resolve(projectPath)
  const relative = path.relative(root, target)
  return (
    relative !== '' &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative) &&
    /\.(?:xcworkspace|xcodeproj)$/.test(target)
  )
}

export function runtimeName(id: string): string {
  const tail = id.split('SimRuntime.')[1] ?? id
  const bits = tail.split('-')
  if (bits[0] === 'iOS') return `iOS ${bits.slice(1).join('.')}`
  return bits.join(' ')
}

export async function simulatorDevices(env: NodeJS.ProcessEnv): Promise<IosDevice[]> {
  const found = await command('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], { env })
  const data = jsonFrom<{
    devices?: Record<string, Array<{ udid?: string; name?: string; state?: string; isAvailable?: boolean }>>
  }>(found.stdout)
  if (!data?.devices) return []
  const devices: IosDevice[] = []
  for (const [runtime, rows] of Object.entries(data.devices)) {
    if (!runtime.includes('SimRuntime.iOS')) continue
    for (const row of rows) {
      if (!row.udid || !row.name || row.isAvailable === false) continue
      devices.push({
        id: row.udid,
        name: row.name,
        os: runtimeName(runtime),
        state: row.state ?? 'Shutdown',
        simulator: true
      })
    }
  }
  return devices.sort((a, b) => b.os.localeCompare(a.os, undefined, { numeric: true }) || a.name.localeCompare(b.name))
}

async function connectedDevices(env: NodeJS.ProcessEnv): Promise<IosDevice[]> {
  const found = await command('xcrun', ['xctrace', 'list', 'devices'], { env, timeout: 15_000 })
  if (!found.stdout) return []
  const devices: IosDevice[] = []
  let physical = false
  for (const line of found.stdout.split('\n')) {
    if (line.startsWith('== Devices ==')) {
      physical = true
      continue
    }
    if (line.startsWith('== Simulators ==')) break
    if (!physical) continue
    const match = /^(.+?) \(([^)]+)\) \(([0-9A-Fa-f-]{20,})\)\s*$/.exec(line.trim())
    if (!match || /Mac$|MacBook|Mac mini|Mac Studio|Mac Pro/i.test(match[1])) continue
    devices.push({ id: match[3], name: match[1], os: match[2], state: 'Connected', simulator: false })
  }
  return devices
}

async function projectInfo(
  container: { path: string; kind: IosProject['kind'] },
  env: NodeJS.ProcessEnv
): Promise<IosProject> {
  const listed = await command('xcodebuild', [...containerArgs(container.path), '-list', '-json'], {
    env,
    timeout: 45_000
  })
  const data = jsonFrom<{
    project?: { schemes?: string[]; targets?: string[]; configurations?: string[] }
    workspace?: { schemes?: string[] }
  }>(listed.stdout)
  return {
    name: path.basename(container.path).replace(/\.(?:xcworkspace|xcodeproj)$/, ''),
    path: container.path,
    kind: container.kind,
    schemes: data?.project?.schemes ?? data?.workspace?.schemes ?? [],
    targets: data?.project?.targets ?? [],
    configurations: data?.project?.configurations ?? []
  }
}

async function xcodeVersion(appPath: string): Promise<string> {
  const plist = path.join(appPath, 'Contents', 'version.plist')
  const found = await command('/usr/bin/plutil', ['-extract', 'CFBundleShortVersionString', 'raw', plist], {
    timeout: 5_000
  })
  return found.ok ? found.stdout.trim() : ''
}

export async function xcodes(selectedDeveloper: string): Promise<IosXcode[]> {
  const selected = selectedDeveloper.replace(/\/Contents\/Developer\/?$/, '')
  const roots = ['/Applications', path.join(os.homedir(), 'Applications')]
  const apps: string[] = []
  for (const root of roots) {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.isDirectory() && /^Xcode.*\.app$/i.test(entry.name)) apps.push(path.join(root, entry.name))
    }
  }
  if (selected.endsWith('.app') && !apps.includes(selected)) {
    const exists = await access(path.join(selected, 'Contents', 'MacOS', 'Xcode'))
      .then(() => true)
      .catch(() => false)
    if (exists) apps.push(selected)
  }
  const unique = [...new Set(apps)]
  const rows = await Promise.all(
    unique.map(async appPath => ({
      name: path.basename(appPath, '.app'),
      path: appPath,
      version: await xcodeVersion(appPath),
      selected: path.resolve(appPath) === path.resolve(selected)
    }))
  )
  return rows.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
}

async function sdks(env: NodeJS.ProcessEnv): Promise<string[]> {
  const found = await command('xcodebuild', ['-showsdks', '-json'], { env })
  const rows = jsonFrom<Array<{ canonicalName?: string; displayName?: string; platform?: string }>>(found.stdout)
  if (Array.isArray(rows)) {
    return [
      ...new Set(
        rows
          .filter(row => /iphone/i.test(`${row.canonicalName} ${row.platform}`))
          .map(row => row.displayName ?? row.canonicalName ?? '')
          .filter(Boolean)
      )
    ]
  }
  const fallback = await command('xcodebuild', ['-showsdks'], { env })
  return [...new Set([...fallback.stdout.matchAll(/-sdk (iphone(?:os|simulator)[^\s]*)/gi)].map(match => match[1]))]
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

export class IosDevelopment {
  private active = new Map<number, ActiveRun>()

  async inspect(
    folder: string,
    xcodePath?: string,
    platform: NodeJS.Platform = process.platform
  ): Promise<IosEnvironment> {
    if (platform !== 'darwin') {
      return {
        available: false,
        reason: 'iOS development is available on macOS.',
        xcodes: [],
        sdks: [],
        projects: [],
        simulators: [],
        devices: []
      }
    }
    const selected = await command('/usr/bin/xcode-select', ['-p'], { timeout: 5_000 })
    if (!selected.ok) {
      return {
        available: false,
        reason: 'Install Xcode to work on iOS projects.',
        xcodes: [],
        sdks: [],
        projects: [],
        simulators: [],
        devices: []
      }
    }
    const installed = await xcodes(developerDir(xcodePath) ?? selected.stdout.trim())
    if (installed.length === 0) {
      return {
        available: false,
        reason: 'Install Xcode to work on iOS projects.',
        xcodes: [],
        sdks: [],
        projects: [],
        simulators: [],
        devices: []
      }
    }
    const chosen = installed.find(xcode => xcode.selected) ?? installed[0]
    const selectedDeveloper = developerDir(chosen.path) as string
    const env = { ...process.env, DEVELOPER_DIR: selectedDeveloper }
    const containers = await projectContainers(folder)
    const [availableSdks, projects, simulators, devices] = await Promise.all([
      sdks(env),
      Promise.all(containers.map(container => projectInfo(container, env))),
      simulatorDevices(env),
      connectedDevices(env)
    ])
    return { available: true, reason: null, xcodes: installed, sdks: availableSdks, projects, simulators, devices }
  }

  async run(
    senderId: number,
    folder: string,
    request: IosRunRequest,
    emit: (output: IosOutput) => void
  ): Promise<IosRunResult> {
    if (process.platform !== 'darwin')
      return { ok: false, action: request.action, exitCode: null, message: 'iOS development is available on macOS.' }
    if (this.active.has(senderId))
      return { ok: false, action: request.action, exitCode: null, message: 'Another iOS action is still running.' }
    if (!iosProjectIn(folder, request.projectPath) || !request.scheme.trim()) {
      return { ok: false, action: request.action, exitCode: null, message: 'Choose a project and scheme first.' }
    }
    const env = xcodeEnv(request.xcodePath)
    const simulators = await simulatorDevices(env)
    const active: ActiveRun = {
      request,
      child: null,
      cancelled: false,
      bundleId: '',
      simulator: simulators.some(device => device.id === request.deviceId)
    }
    this.active.set(senderId, active)
    const say = (stream: IosOutput['stream'], text: string) =>
      emit({ runId: request.runId, stream, text, ts: Date.now() })
    try {
      if (active.simulator && request.action === 'run') {
        await command('xcrun', ['simctl', 'boot', request.deviceId], { env, timeout: 20_000 })
        await command('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', request.deviceId], {
          env,
          timeout: 10_000
        })
        const ready = await command('xcrun', ['simctl', 'bootstatus', request.deviceId, '-b'], {
          env,
          timeout: 120_000
        })
        if (!ready.ok) say('stderr', ready.stderr || 'The simulator did not finish starting.\n')
      }
      const args = iosBuildArguments(request)
      const built = await this.stream(active, 'xcodebuild', args, folder, env, say)
      if (active.cancelled) return { ok: false, action: request.action, exitCode: built, message: 'Stopped.' }
      if (built !== 0)
        return {
          ok: false,
          action: request.action,
          exitCode: built,
          message: `${request.action === 'test' ? 'Tests' : 'Build'} failed.`
        }
      if (request.action !== 'run')
        return {
          ok: true,
          action: request.action,
          exitCode: built,
          message: request.action === 'test' ? 'Tests passed.' : 'Build succeeded.'
        }
      const settings = await this.buildSettings(request, env)
      if (!settings.appPath || !settings.bundleId) {
        return { ok: false, action: request.action, exitCode: null, message: 'The built app could not be found.' }
      }
      active.bundleId = settings.bundleId
      say('system', `Installing ${path.basename(settings.appPath)} on ${request.deviceId}\n`)
      const installed = active.simulator
        ? await command('xcrun', ['simctl', 'install', request.deviceId, settings.appPath], { env, timeout: 120_000 })
        : await command(
            'xcrun',
            ['devicectl', 'device', 'install', 'app', '--device', request.deviceId, settings.appPath],
            { env, timeout: 120_000 }
          )
      if (!installed.ok) {
        say('stderr', installed.stderr || installed.stdout)
        return {
          ok: false,
          action: request.action,
          exitCode: installed.code,
          message: 'The app could not be installed.'
        }
      }
      const launchArgs = active.simulator
        ? ['simctl', 'launch', '--console-pty', request.deviceId, settings.bundleId]
        : ['devicectl', 'device', 'process', 'launch', '--console', '--device', request.deviceId, settings.bundleId]
      say('system', `Launching ${settings.bundleId}\n`)
      const launched = await this.stream(active, 'xcrun', launchArgs, folder, env, say)
      if (active.cancelled) return { ok: false, action: request.action, exitCode: launched, message: 'Stopped.' }
      return launched === 0
        ? { ok: true, action: request.action, exitCode: launched, message: 'App finished.' }
        : { ok: false, action: request.action, exitCode: launched, message: 'The app stopped with an error.' }
    } finally {
      if (this.active.get(senderId) === active) this.active.delete(senderId)
    }
  }

  async stop(senderId: number): Promise<boolean> {
    const active = this.active.get(senderId)
    if (!active) return false
    active.cancelled = true
    stopChild(active.child)
    const env = xcodeEnv(active.request.xcodePath)
    if (active.bundleId && active.request.deviceId) {
      if (active.simulator)
        await command('xcrun', ['simctl', 'terminate', active.request.deviceId, active.bundleId], {
          env,
          timeout: 10_000
        })
    }
    return true
  }

  async screenshot(folder: string, deviceId: string, xcodePath?: string): Promise<IosScreenshot | null> {
    if (process.platform !== 'darwin' || !deviceId) return null
    const env = xcodeEnv(xcodePath)
    const simulators = await simulatorDevices(env)
    if (!simulators.some(device => device.id === deviceId)) return null
    const target = path.join(os.tmpdir(), `crew-ios-${process.pid}-${Date.now()}.png`)
    try {
      const result = await command('xcrun', ['simctl', 'io', deviceId, 'screenshot', target], {
        cwd: folder,
        env,
        timeout: 20_000
      })
      if (!result.ok) return null
      const bytes = await readFile(target)
      return { deviceId, dataUrl: `data:image/png;base64,${bytes.toString('base64')}`, capturedAt: Date.now() }
    } finally {
      await rm(target, { force: true }).catch(() => undefined)
    }
  }

  async openProject(folder: string, projectPath: string, xcodePath?: string): Promise<boolean> {
    if (process.platform !== 'darwin' || !iosProjectIn(folder, projectPath)) return false
    const appPath = xcodePath || 'Xcode'
    const opened = await command('open', ['-a', appPath, projectPath], { timeout: 10_000 })
    return opened.ok
  }

  async openSimulator(deviceId: string): Promise<boolean> {
    if (process.platform !== 'darwin') return false
    const args = ['-a', 'Simulator']
    if (deviceId) args.push('--args', '-CurrentDeviceUDID', deviceId)
    return (await command('open', args, { timeout: 10_000 })).ok
  }

  async openXcode(xcodePath?: string): Promise<boolean> {
    if (process.platform !== 'darwin') return false
    return (await command('open', ['-a', xcodePath || 'Xcode'], { timeout: 10_000 })).ok
  }

  create(folder: string, input: IosCreateRequest): Promise<IosCreateResult> {
    if (process.platform !== 'darwin')
      return Promise.resolve({ ok: false, message: 'iOS development is available on macOS.' })
    return createIosProject(folder, input)
  }

  close(senderId: number): void {
    const active = this.active.get(senderId)
    if (!active) return
    active.cancelled = true
    stopChild(active.child)
    this.active.delete(senderId)
  }

  private stream(
    active: ActiveRun,
    file: string,
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
    emit: (stream: IosOutput['stream'], text: string) => void
  ): Promise<number | null> {
    emit('system', `$ ${prettyCommand(file, args)}\n`)
    return new Promise(resolve => {
      const child = spawn(file, args, { cwd, env, detached: process.platform !== 'win32', stdio: 'pipe' })
      active.child = child
      child.stdout.on('data', chunk => emit('stdout', String(chunk)))
      child.stderr.on('data', chunk => emit('stderr', String(chunk)))
      child.on('error', error => {
        emit('stderr', `${error.message}\n`)
        resolve(null)
      })
      child.on('close', code => {
        if (active.child === child) active.child = null
        resolve(code)
      })
    })
  }

  private async buildSettings(
    request: IosRunRequest,
    env: NodeJS.ProcessEnv
  ): Promise<{ appPath: string; bundleId: string }> {
    const args = [...containerArgs(request.projectPath), '-scheme', request.scheme, '-configuration', 'Debug']
    if (request.deviceId) args.push('-destination', `id=${request.deviceId}`)
    args.push('-showBuildSettings', '-json')
    const found = await command('xcodebuild', args, { cwd: path.dirname(request.projectPath), env, timeout: 60_000 })
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

export { hasIosProject, projectContainers }
