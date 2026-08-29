import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { appLaunch, childEnv, openFlag, parseArgs } from '../bin/crew.mjs'
import { cleanOpenRequest, openRequestOf } from '../src/shared/cli'

const CWD = '/work/site'

function opened(argv: string[]) {
  const parsed = parseArgs(argv, CWD)
  if (parsed.kind !== 'open') throw new Error(`expected an open, got ${parsed.kind}`)
  return parsed.request
}

describe('the crew command', () => {
  it('opens the folder you are in when you name none', () => {
    expect(opened([])).toEqual({ folder: CWD })
  })

  it('resolves a folder against where it was run', () => {
    expect(opened(['../api']).folder).toBe(path.resolve(CWD, '../api'))
    expect(opened(['/tmp/thing']).folder).toBe(path.resolve('/tmp/thing'))
  })

  it('takes the name you go by', () => {
    expect(opened(['-n', 'Jamel']).name).toBe('Jamel')
    expect(opened(['--name', 'Ali']).name).toBe('Ali')
  })

  it('says where the crew should live', () => {
    expect(opened(['--in-project']).home).toBe('folder')
    expect(opened(['--in-app']).home).toBe('private')
    expect(opened([]).home).toBeUndefined()
  })

  it('says who can reach it', () => {
    expect(opened(['--share']).share).toBe(true)
    expect(opened(['--no-share']).share).toBe(false)
    expect(opened([]).share).toBeUndefined()
  })

  it('joins with a link, in the folder it was given', () => {
    const request = opened(['../api', '--join', 'crew://192.0.2.10:2739/abc123'])
    expect(request.link).toBe('crew://192.0.2.10:2739/abc123')
    expect(request.folder).toBe(path.resolve(CWD, '../api'))
  })

  it("refuses to be told where somebody else's crew lives", () => {
    expect(parseArgs(['--join', 'crew://host:2739/abc', '--share'], CWD).kind).toBe('error')
    expect(parseArgs(['--join', 'crew://host:2739/abc', '--in-app'], CWD).kind).toBe('error')
  })

  it('says so rather than guessing', () => {
    expect(parseArgs(['--sideways'], CWD)).toMatchObject({ kind: 'error' })
    expect(parseArgs(['--name'], CWD)).toMatchObject({ kind: 'error' })
    expect(parseArgs(['--join', '--share'], CWD)).toMatchObject({ kind: 'error' })
    expect(parseArgs(['one', 'two'], CWD)).toMatchObject({ kind: 'error' })
  })

  it('answers for itself', () => {
    expect(parseArgs(['-h'], CWD).kind).toBe('help')
    expect(parseArgs(['--help'], CWD).kind).toBe('help')
    expect(parseArgs(['-v'], CWD).kind).toBe('version')
    expect(parseArgs(['--version'], CWD).kind).toBe('version')
  })
})

describe('what the command hands the app', () => {
  it('arrives as it was sent', () => {
    const request = opened(['/work/api', '-n', 'Jamel', '--in-project', '--share'])
    expect(openRequestOf(['electron', '.', openFlag(request), '--other'])).toEqual(request)
  })

  it('is nothing at all without the flag', () => {
    expect(openRequestOf(['electron', '.'])).toBeNull()
    expect(openRequestOf(['--crew-open=not json'])).toBeNull()
    expect(openRequestOf(['--crew-open={"name":"Jamel"}'])).toBeNull()
  })

  it('keeps only what it knows', () => {
    expect(
      cleanOpenRequest({ folder: '/work/api', file: 'src/main.ts', home: 'somewhere', share: 'yes', name: '  ' })
    ).toEqual({ folder: '/work/api', file: 'src/main.ts' })
    expect(cleanOpenRequest({ folder: '/work/api', file: '../other/secret' })).toEqual({ folder: '/work/api' })
    expect(cleanOpenRequest({ folder: '/work/api', file: '/other/secret' })).toEqual({ folder: '/work/api' })
    expect(cleanOpenRequest(null)).toBeNull()
    expect(cleanOpenRequest({ folder: '   ' })).toBeNull()
  })
})

describe('the Crew it opens', () => {
  const has =
    (...found: string[]) =>
    (target: string) =>
      found.includes(target)

  it('is the one CREW_APP names', () => {
    const launch = appLaunch('darwin', { CREW_APP: '/opt/mine/Crew' }, '/Users/jamel', '/repo', () => false)
    expect(launch).toEqual({ command: '/opt/mine/Crew', args: [] })
  })

  it('is the installed app before the one built here', () => {
    const installed = '/Applications/Crew.app/Contents/MacOS/Crew'
    const launch = appLaunch('darwin', {}, '/Users/jamel', '/repo', has(installed, '/repo/out/main/index.js'))
    expect(launch).toEqual({ command: installed, args: [] })
  })

  it('falls back to the one built in this checkout', () => {
    const electron = path.join('/repo', 'node_modules', '.bin', 'electron')
    const built = path.join('/repo', 'out', 'main', 'index.js')
    const launch = appLaunch('darwin', {}, '/Users/jamel', '/repo', has(electron, built))
    expect(launch).toEqual({ command: electron, args: ['/repo'] })
  })

  // The command that ships inside the app is the app itself in node's clothing,
  // and that rides in the environment. Passed on, the Crew being opened comes up
  // as a node process with no window.
  it('is opened as an app, never as another node', () => {
    const env = childEnv({ ELECTRON_RUN_AS_NODE: '1', CREW_APP: '/Applications/Crew.app/x', PATH: '/bin' })
    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined()
    expect(env).toEqual({ CREW_APP: '/Applications/Crew.app/x', PATH: '/bin' })
  })

  it('is nothing when there is no build and no app', () => {
    const electron = path.join('/repo', 'node_modules', '.bin', 'electron')
    expect(appLaunch('darwin', {}, '/Users/jamel', '/repo', has(electron))).toBeNull()
    expect(appLaunch('linux', {}, '/home/jamel', '/repo', () => false)).toBeNull()
  })
})
