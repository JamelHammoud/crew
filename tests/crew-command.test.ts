import { execFileSync } from 'node:child_process'
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  asAdmin,
  COMMAND_DIR,
  COMMAND_LINK,
  commandScript,
  installLine,
  removeLine,
  shellWord,
  shipsCommand,
  turnedDown
} from '../src/shared/crewCommand'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('the command that comes with the app', () => {
  const packaged = {
    platform: 'darwin',
    fromSource: false,
    appPath: '/Applications/Crew.app/Contents/Resources/app.asar',
    resourcesPath: '/Applications/Crew.app/Contents/Resources'
  }

  it('is the shell one inside the app, which needs no node on the machine', () => {
    expect(commandScript(packaged)).toBe('/Applications/Crew.app/Contents/Resources/cli/bin/crew')
  })

  // yarn start runs the built app out of the checkout, so what it links is the
  // file standing right there rather than one in a bundle it does not have.
  it('is the one in the checkout when the app is run from source', () => {
    expect(commandScript({ ...packaged, fromSource: true, appPath: '/work/crew' })).toBe('/work/crew/bin/crew.mjs')
  })

  it('is nothing on Windows, where there is no folder every shell reads', () => {
    expect(commandScript({ ...packaged, platform: 'win32' })).toBeNull()
    expect(shipsCommand('win32')).toBe(false)
    expect(shipsCommand('darwin')).toBe(true)
    expect(shipsCommand('linux')).toBe(true)
  })
})

describe('the line that puts it on PATH', () => {
  it('quotes the path, so a folder with a space in it is one word', () => {
    const line = installLine('/Users/jamel/My Apps/Crew.app/Contents/Resources/cli/bin/crew')
    expect(line).toContain(`'/Users/jamel/My Apps/Crew.app/Contents/Resources/cli/bin/crew'`)
    expect(line).toContain(`ln -sf`)
    expect(line).toContain(COMMAND_LINK)
  })

  it('closes a quote nothing may reach out of', () => {
    expect(installLine(`/tmp/it's here/crew`)).toContain(`'/tmp/it'\\''s here/crew'`)
  })

  // A real shell reading it back is the only thing that says the quoting holds,
  // and the whole line cannot be run for real: it writes to /usr/local/bin.
  it.skipIf(process.platform === 'win32')('is one word to a real shell', () => {
    for (const odd of ["/tmp/it's here/crew", '/tmp/My Apps/crew', '/tmp/$HOME `x`/crew']) {
      const said = execFileSync('sh', ['-c', `printf %s ${shellWord(odd)}`]).toString()
      expect(said).toBe(odd)
    }
  })

  it('takes the link off again', () => {
    expect(removeLine()).toBe(`rm -f '${COMMAND_LINK}'`)
  })

  it('asks for a password with the same line, quotes and all', () => {
    const asked = asAdmin(`ln -sf '/Applications/Crew.app/x' '${COMMAND_LINK}'`)
    expect(asked.startsWith('do shell script "')).toBe(true)
    expect(asked.endsWith('" with administrator privileges')).toBe(true)
    expect(asAdmin('say "hi" \\ now')).toContain('say \\"hi\\" \\\\ now')
  })

  it('says nothing when somebody turns the password dialog down', () => {
    expect(turnedDown('User canceled. (-128)', 1)).toBe(true)
    expect(turnedDown('Error: Command failed', 126)).toBe(true)
    expect(turnedDown('Operation not permitted', 1)).toBe(false)
  })

  it('goes where every shell already looks', () => {
    expect(COMMAND_DIR).toBe('/usr/local/bin')
  })
})

// The shell launcher is the one piece no unit can see: it has to follow a link
// home, find the app it came with, and run the app itself as node. So it is run
// for real, through a link, against a stand-in app that says what it was handed.
describe('the launcher inside the app', () => {
  let room = ''

  afterEach(() => {
    if (room) rmSync(room, { recursive: true, force: true })
    room = ''
  })

  const bundle = (): string => {
    room = mkdtempSync(path.join(os.tmpdir(), 'crew-launcher-'))
    const contents = path.join(room, 'Crew.app', 'Contents')
    const cli = path.join(contents, 'Resources', 'cli', 'bin')
    mkdirSync(cli, { recursive: true })
    mkdirSync(path.join(contents, 'MacOS'), { recursive: true })
    cpSync(path.join(repo, 'bin', 'crew'), path.join(cli, 'crew'))
    chmodSync(path.join(cli, 'crew'), 0o755)
    writeFileSync(path.join(cli, 'crew.mjs'), '')
    const app = path.join(contents, 'MacOS', 'Crew')
    writeFileSync(app, '#!/bin/sh\nprintf "%s\\n" "$ELECTRON_RUN_AS_NODE" "$CREW_APP" "$@"\n')
    chmodSync(app, 0o755)
    const link = path.join(room, 'crew')
    symlinkSync(path.join(cli, 'crew'), link)
    return link
  }

  const ran = (link: string, args: string[], env: NodeJS.ProcessEnv = {}) =>
    execFileSync(link, args, { env: { PATH: process.env.PATH ?? '', ...env } })
      .toString()
      .trim()
      .split('\n')

  it.skipIf(process.platform === 'win32')('follows the link home, and runs the app it came with as node', () => {
    const link = bundle()
    const said = ran(link, ['/work/api', '--name', 'Jamel'])
    const app = path.join(room, 'Crew.app', 'Contents', 'MacOS', 'Crew')
    expect(said[0]).toBe('1')
    expect(said[1]).toBe(app)
    expect(said[2]).toBe(path.join(room, 'Crew.app', 'Contents', 'Resources', 'cli', 'bin', 'crew.mjs'))
    expect(said.slice(3)).toEqual(['/work/api', '--name', 'Jamel'])
  })

  it.skipIf(process.platform === 'win32')('opens the Crew that CREW_APP names, whoever it came with', () => {
    const link = bundle()
    expect(ran(link, [], { CREW_APP: '/opt/mine/Crew' })[1]).toBe('/opt/mine/Crew')
  })

  it.skipIf(process.platform === 'win32')('says so when the app it came with has gone', () => {
    const link = bundle()
    rmSync(path.join(room, 'Crew.app', 'Contents', 'MacOS'), { recursive: true, force: true })
    expect(() => execFileSync(link, [], { stdio: 'pipe' })).toThrow(/has gone/)
  })
})
