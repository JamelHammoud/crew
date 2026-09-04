import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { asAdmin, turnedDown } from '../shared/crewCommand'
import { iosSetupPlan, pointsAtXcode, type IosMachine, type IosSetup } from '../shared/iosSetup'
import { command, jsonFrom } from './ios-command'
import { xcodes } from './ios-development'

export interface IosSetupDone {
  ok: boolean
  message: string
  turnedDown?: boolean
}

const RUNTIME_TIMEOUT = 45 * 60_000

async function licensed(developer: string): Promise<boolean> {
  if (!pointsAtXcode(developer)) return false
  const found = await command('/usr/bin/xcrun', ['clang', '--version'], {
    env: { ...process.env, DEVELOPER_DIR: developer },
    timeout: 15_000
  })
  return found.ok && !/license/i.test(`${found.stderr}${found.stdout}`)
}

async function firstLaunched(developer: string): Promise<boolean> {
  if (!pointsAtXcode(developer)) return false
  const found = await command('/usr/bin/xcodebuild', ['-checkFirstLaunchStatus'], {
    env: { ...process.env, DEVELOPER_DIR: developer },
    timeout: 30_000
  })
  return found.ok
}

export async function iosRuntimes(developer: string): Promise<string[]> {
  if (!pointsAtXcode(developer)) return []
  const env = { ...process.env, DEVELOPER_DIR: developer }
  const found = await command('/usr/bin/xcrun', ['simctl', 'list', 'runtimes', '-j'], { env })
  const data = jsonFrom<{
    runtimes?: Array<{ name?: string; version?: string; platform?: string; isAvailable?: boolean }>
  }>(found.stdout)
  return (data?.runtimes ?? [])
    .filter(row => row.isAvailable !== false && /iOS/i.test(`${row.platform ?? ''}${row.name ?? ''}`))
    .map(row => row.version || row.name || '')
    .filter(Boolean)
}

export async function readIosMachine(platform: NodeJS.Platform = process.platform): Promise<IosMachine> {
  if (platform !== 'darwin')
    return { mac: false, xcodes: [], developer: '', license: false, components: false, runtimes: [] }
  const selected = await command('/usr/bin/xcode-select', ['-p'], { timeout: 5_000 })
  const developer = selected.ok ? selected.stdout.trim() : ''
  const installed = await xcodes(developer)
  const [license, components, runtimes] = await Promise.all([
    licensed(developer),
    firstLaunched(developer),
    iosRuntimes(developer)
  ])
  return { mac: true, xcodes: installed.map(xcode => xcode.path), developer, license, components, runtimes }
}

export async function readIosSetup(platform: NodeJS.Platform = process.platform): Promise<IosSetup> {
  return iosSetupPlan(await readIosMachine(platform))
}

async function anyXcode(): Promise<string | null> {
  for (const root of ['/Applications', path.join(process.env.HOME ?? '', 'Applications')]) {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
    const app = entries.find(entry => entry.isDirectory() && /^Xcode.*\.app$/i.test(entry.name))
    if (app) return path.join(root, app.name)
  }
  return null
}

function shellWord(value: string): string {
  return `'${value.split("'").join(`'\\''`)}'`
}

// Every step Apple lets an app take, in one password rather than one each. What
// is left after this is only ever the download itself, which nobody can do for
// somebody who has not signed in to Apple.
export async function finishIosSetup(): Promise<IosSetupDone> {
  if (process.platform !== 'darwin') return { ok: false, message: 'iPhone apps are built on a Mac.' }
  const app = await anyXcode()
  if (!app) return { ok: false, message: 'Xcode comes from the App Store.' }
  const developer = path.join(app, 'Contents', 'Developer')
  const build = shellWord(path.join(developer, 'usr/bin/xcodebuild'))
  const line = [`xcode-select -s ${shellWord(developer)}`, `${build} -license accept`, `${build} -runFirstLaunch`].join(
    ' && '
  )
  const ran = await command('/usr/bin/osascript', ['-e', asAdmin(line)], { timeout: 20 * 60_000 })
  if (!ran.ok) {
    const said = `${ran.stderr}${ran.stdout}`
    if (turnedDown(said, ran.code)) return { ok: false, message: '', turnedDown: true }
    return { ok: false, message: said.trim() || 'That did not go through.' }
  }
  if ((await iosRuntimes(developer)).length > 0) return { ok: true, message: '' }
  const downloaded = await command('/usr/bin/xcodebuild', ['-downloadPlatform', 'iOS'], {
    env: { ...process.env, DEVELOPER_DIR: developer },
    timeout: RUNTIME_TIMEOUT
  })
  if (downloaded.ok) return { ok: true, message: '' }
  return {
    ok: false,
    message: `${downloaded.stderr}${downloaded.stdout}`.trim() || 'The simulator did not download.'
  }
}
