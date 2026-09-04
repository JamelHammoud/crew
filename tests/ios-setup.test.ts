import { describe, expect, it } from 'vitest'
import { iosSetupPlan, newestRuntime, pointsAtXcode, type IosMachine } from '../src/shared/iosSetup'
import { iosIssuesIn, iosSays, watchedFile, type IosLiveState } from '../src/shared/iosLive'
import { iosBuildLog, iosPreamble, iosWorkDir } from '../src/shared/iosAgent'
import { hasIosProject } from '../src/shared/iosProject'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bundleFor, pickDevice, projectName } from '../src/main/ios-live'
import type { IosDevice } from '../src/shared/ios'

const machine = (patch: Partial<IosMachine> = {}): IosMachine => ({
  mac: true,
  xcodes: ['/Applications/Xcode.app'],
  developer: '/Applications/Xcode.app/Contents/Developer',
  license: true,
  components: true,
  runtimes: ['27.0'],
  ...patch
})

describe('getting a Mac ready for iOS', () => {
  it('is ready only once there is a simulator to run on', () => {
    expect(iosSetupPlan(machine()).need).toBe('ready')
    expect(iosSetupPlan(machine({ runtimes: [] })).need).toBe('finish')
  })

  it('names Xcode as the one thing Crew cannot do, and does the rest on one press', () => {
    const missing = iosSetupPlan(machine({ xcodes: [], developer: '/Library/Developer/CommandLineTools' }))
    expect(missing.need).toBe('xcode')
    expect(missing.says).toContain('App Store')
    const rest = iosSetupPlan(machine({ license: false }))
    expect(rest.need).toBe('finish')
    expect(rest.button).toBe('Set it up')
  })

  it('reads command line tools as not being Xcode', () => {
    expect(pointsAtXcode('/Library/Developer/CommandLineTools')).toBe(false)
    expect(pointsAtXcode('/Applications/Xcode.app/Contents/Developer')).toBe(true)
    expect(iosSetupPlan(machine({ developer: '/Library/Developer/CommandLineTools' })).need).toBe('finish')
  })

  it('says the one true thing on a machine that is not a Mac', () => {
    const plan = iosSetupPlan(machine({ mac: false }))
    expect(plan.ready).toBe(false)
    expect(plan.says).toContain('Mac')
    expect(plan.button).toBe('')
  })

  it('takes the newest runtime rather than the first', () => {
    expect(newestRuntime(['18.4', '27.0', '26.2'])).toBe('27.0')
    expect(newestRuntime(['iOS 26.0', 'iOS 27.1'])).toBe('iOS 27.1')
    expect(newestRuntime([])).toBe(null)
  })
})

describe('whether a folder builds an app', () => {
  it('is the project in it and never a command anybody typed', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'crew-ios-'))
    expect(await hasIosProject(folder)).toBe(false)
    await mkdir(join(folder, 'Sources'), { recursive: true })
    expect(await hasIosProject(folder)).toBe(false)
    await mkdir(join(folder, 'Sources', 'App.xcodeproj'), { recursive: true })
    expect(await hasIosProject(folder)).toBe(true)
  })

  it('passes over the build output, so a folder is read by what somebody wrote', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'crew-ios-'))
    await mkdir(join(folder, 'DerivedData', 'Old.xcodeproj'), { recursive: true })
    await mkdir(join(folder, 'Pods', 'Pods.xcodeproj'), { recursive: true })
    expect(await hasIosProject(folder)).toBe(false)
  })
})

describe('reading a build', () => {
  it('picks placed errors and warnings out of xcodebuild output', () => {
    const issues = iosIssuesIn(
      [
        "/repo/App/ContentView.swift:12:9: error: cannot find 'titl' in scope",
        "/repo/App/ContentView.swift:12:9: error: cannot find 'titl' in scope",
        '/repo/App/Model.swift:4:1: warning: never used',
        'ld: symbol(s) not found',
        'error: linker command failed'
      ].join('\n')
    )
    expect(issues).toHaveLength(3)
    expect(issues[0]).toMatchObject({ kind: 'error', file: '/repo/App/ContentView.swift', line: 12, column: 9 })
    expect(issues.at(-1)).toMatchObject({ kind: 'warning' })
    expect(issues.some(issue => issue.message === 'linker command failed')).toBe(true)
  })

  it('watches source and assets and never the build output', () => {
    expect(watchedFile('App/ContentView.swift')).toBe(true)
    expect(watchedFile('App/Assets.xcassets/AppIcon.appiconset/Contents.json')).toBe(true)
    expect(watchedFile('App/App.xcodeproj/project.pbxproj')).toBe(true)
    expect(watchedFile('build/Debug-iphonesimulator/App.app/App.swift')).toBe(false)
    expect(watchedFile('DerivedData/App/Build/x.swift')).toBe(false)
    expect(watchedFile('.git/COMMIT_EDITMSG')).toBe(false)
    expect(watchedFile('README')).toBe(false)
  })

  it('says how many errors stopped the build', () => {
    const state: IosLiveState = {
      phase: 'failed',
      folder: '/repo',
      project: '/repo/App.xcodeproj',
      scheme: 'App',
      bundleId: '',
      device: null,
      message: '',
      issues: iosIssuesIn('/repo/A.swift:1:1: error: no'),
      builds: 0,
      builtAt: 0,
      setup: null
    }
    expect(iosSays(state)).toBe('1 error')
    expect(iosSays({ ...state, phase: 'building' })).toBe('Building')
  })
})

describe('what the agent is told', () => {
  it('names the one file the build result is written to', () => {
    const folder = '/repo/app'
    expect(iosBuildLog(folder)).toBe(`${iosWorkDir(folder)}/build.txt`)
    expect(iosBuildLog(folder).startsWith(iosWorkDir(folder))).toBe(true)
    expect(iosPreamble('http://127.0.0.1:1/abc', 'p1', folder)).toContain(iosBuildLog(folder))
  })

  it('keeps the build log out of the project', () => {
    expect(iosWorkDir('/repo/app').startsWith('/repo/app')).toBe(false)
    expect(iosWorkDir('/repo/a')).not.toBe(iosWorkDir('/repo/b'))
  })

  it('tells the agent not to drive the tools itself, and how to put the app up', () => {
    const said = iosPreamble('http://127.0.0.1:1/abc', 'p1', '/repo')
    expect(said).toContain('Never run xcodebuild')
    expect(said).toContain('rebuilds')
    expect(said).toContain('http://127.0.0.1:1/abc/ios')
    expect(said).toContain('"promptId":"p1"')
  })
})

describe('picking what to run on', () => {
  const sim = (name: string, os: string): IosDevice => ({
    id: `${name}-${os}`,
    name,
    os,
    state: 'Shutdown',
    simulator: true
  })

  it('takes an iPhone on the newest runtime installed', () => {
    const found = pickDevice([sim('iPad Pro', 'iOS 27.0'), sim('iPhone 16', 'iOS 26.0'), sim('iPhone 18', 'iOS 27.0')])
    expect(found?.name).toBe('iPhone 18')
  })

  it('takes whatever is there rather than nothing', () => {
    expect(pickDevice([sim('iPad Air', 'iOS 27.0')])?.name).toBe('iPad Air')
    expect(pickDevice([])).toBe(null)
  })

  it('names a project after the folder, and always starts with a letter', () => {
    expect(projectName('/Users/ali/habit-tracker')).toBe('HabitTracker')
    expect(projectName('/Users/ali/2048')).toBe('App2048')
    expect(bundleFor('HabitTracker')).toBe('com.crew.habittracker')
  })
})
