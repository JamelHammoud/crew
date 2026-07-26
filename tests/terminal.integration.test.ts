import { existsSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { shellFor, startingFolder, terminalEnv, Terminals, type TerminalSink } from '../src/main/terminal'

const unix = process.platform !== 'win32'

// A real pty running a real shell, but the plainest one on the machine.
// Whoever runs this has their own login shell, and some of them take seconds
// to read their profile before they say anything.
if (unix) process.env['SHELL'] = '/bin/sh'

function listener(): { sink: TerminalSink; text(): string; exits: string[] } {
  let text = ''
  const exits: string[] = []
  return {
    sink: {
      data: (_id, chunk) => {
        text += chunk
      },
      exit: id => void exits.push(id)
    },
    text: () => text,
    exits
  }
}

async function until(ready: () => boolean, label: string): Promise<void> {
  for (let tries = 0; tries < 200; tries++) {
    if (ready()) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`timed out waiting for ${label}`)
}

const scratch = (name: string): string => path.join(os.tmpdir(), `crew-pty-${process.pid}-${name}`)

const open = new Set<Terminals>()

function terminals(): Terminals {
  const made = new Terminals()
  open.add(made)
  return made
}

afterEach(() => {
  for (const made of open) made.closeAll()
  open.clear()
})

describe('the shell a terminal opens', () => {
  it('is the login shell this machine would open by hand', () => {
    expect(shellFor('darwin', { SHELL: '/bin/fish' })).toEqual({ file: '/bin/fish', args: ['-l'] })
    expect(shellFor('darwin', {})).toEqual({ file: '/bin/zsh', args: ['-l'] })
    expect(shellFor('linux', {})).toEqual({ file: '/bin/bash', args: ['-l'] })
    expect(shellFor('win32', { SystemRoot: 'D:\\Windows' })).toEqual({
      file: 'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      args: []
    })
  })

  it('starts in the project folder, and at home when there is no project', () => {
    expect(startingFolder(process.cwd())).toBe(process.cwd())
    expect(startingFolder(null)).toBe(os.homedir())
    expect(startingFolder('/nowhere/at/all')).toBe(os.homedir())
  })

  it('carries a colour terminal and none of the marks of how crew was started', () => {
    const env = terminalEnv({
      PATH: '/usr/bin',
      NODE_ENV: 'production',
      INIT_CWD: '/somewhere',
      npm_package_name: 'crew',
      ELECTRON_RUN_AS_NODE: '1',
      TERM: 'dumb'
    })
    expect(env).toEqual({
      PATH: '/usr/bin',
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'crew'
    })
  })
})

describe.skipIf(!unix)('a terminal tab', () => {
  it('answers what is typed into it', async () => {
    const heard = listener()
    const made = terminals()
    made.open('tab-1', process.cwd(), { cols: 80, rows: 24 }, heard.sink)
    made.write('tab-1', 'echo crew-terminal-works\r')

    await until(() => heard.text().includes('crew-terminal-works\r\n'), 'the shell to answer')
    expect(made.count()).toBe(1)
  })

  it('runs in the project folder at the size it was given', async () => {
    const out = scratch('size')
    rmSync(out, { force: true })
    const made = terminals()
    made.open('tab-2', process.cwd(), { cols: 100, rows: 30 }, listener().sink)
    made.write('tab-2', `{ pwd; stty size; } > ${out}\r`)

    await until(() => existsSync(out) && readFileSync(out, 'utf8').split('\n').length > 2, 'the shell to report')
    expect(readFileSync(out, 'utf8').trim().split('\n')).toEqual([process.cwd(), '30 100'])
    rmSync(out, { force: true })
  })

  it('tells the shell when the panel is resized', async () => {
    const out = scratch('resize')
    rmSync(out, { force: true })
    const made = terminals()
    made.open('tab-3', process.cwd(), { cols: 100, rows: 30 }, listener().sink)
    made.resize('tab-3', { cols: 132, rows: 44 })
    made.write('tab-3', `stty size > ${out}\r`)

    await until(() => existsSync(out) && readFileSync(out, 'utf8').trim().length > 0, 'the new size')
    expect(readFileSync(out, 'utf8').trim()).toBe('44 132')
    rmSync(out, { force: true })
  })

  it('says so when the shell is left', async () => {
    const heard = listener()
    const made = terminals()
    made.open('tab-4', process.cwd(), { cols: 80, rows: 24 }, heard.sink)
    made.write('tab-4', 'exit\r')

    await until(() => heard.exits.includes('tab-4'), 'the shell to leave')
    expect(made.count()).toBe(0)
  })

  it('takes the shell with it when the tab is closed, and says nothing more about it', async () => {
    const heard = listener()
    const made = terminals()
    made.open('tab-5', process.cwd(), { cols: 80, rows: 24 }, heard.sink)
    await until(() => heard.text().length > 0, 'the shell to start')
    made.close('tab-5')
    expect(made.count()).toBe(0)

    const said = heard.text().length
    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(heard.exits).not.toContain('tab-5')
    expect(heard.text().length).toBe(said)
  })

  // React mounts a view twice while developing, so a terminal is opened,
  // closed, and opened again under the same name in the same breath.
  it('keeps the second shell when a tab is opened again as the first one ends', async () => {
    const heard = listener()
    const made = terminals()
    made.open('tab-8', process.cwd(), { cols: 80, rows: 24 }, heard.sink)
    made.close('tab-8')
    made.open('tab-8', process.cwd(), { cols: 80, rows: 24 }, heard.sink)

    made.write('tab-8', 'echo still-listening\r')
    await until(() => heard.text().includes('still-listening\r\n'), 'the second shell to answer')
    expect(made.count()).toBe(1)
    expect(heard.exits).not.toContain('tab-8')
  })

  it('opens onto the prompt a shell kept ready has already printed', async () => {
    const heard = listener()
    const made = terminals()
    made.warm(process.cwd())
    await until(() => made.ready(), 'a shell to stand by')

    made.open('tab-9', process.cwd(), { cols: 80, rows: 24 }, heard.sink)
    expect(heard.text().length).toBeGreaterThan(0)

    made.write('tab-9', 'echo warm-shell-answers\r')
    await until(() => heard.text().includes('warm-shell-answers\r\n'), 'the warmed shell to answer')
    expect(made.count()).toBe(1)
  })

  it('tells a shell kept ready the size of the tab that took it', async () => {
    const out = scratch('warm-size')
    rmSync(out, { force: true })
    const made = terminals()
    made.warm(process.cwd())
    await until(() => made.ready(), 'a shell to stand by')

    made.open('tab-10', process.cwd(), { cols: 100, rows: 30 }, listener().sink)
    made.write('tab-10', `stty size > ${out}\r`)

    await until(() => existsSync(out) && readFileSync(out, 'utf8').trim().length > 0, 'the shell to report')
    expect(readFileSync(out, 'utf8').trim()).toBe('30 100')
    rmSync(out, { force: true })
  })

  it('never hands a tab a shell warmed for another folder', async () => {
    const out = scratch('warm-folder')
    rmSync(out, { force: true })
    const made = terminals()
    made.warm(os.tmpdir())
    await until(() => made.ready(), 'a shell to stand by')

    made.open('tab-11', process.cwd(), { cols: 80, rows: 24 }, listener().sink)
    made.write('tab-11', `pwd > ${out}\r`)

    await until(() => existsSync(out) && readFileSync(out, 'utf8').trim().length > 0, 'the shell to report')
    expect(readFileSync(out, 'utf8').trim()).toBe(process.cwd())
    rmSync(out, { force: true })
  })

  it('takes the shell it was keeping ready with it when the window goes', async () => {
    const made = terminals()
    made.warm(process.cwd())
    await until(() => made.ready(), 'a shell to stand by')

    made.closeAll()
    expect(made.ready()).toBe(false)
  })

  it('keeps two terminals apart', async () => {
    const heard = listener()
    const made = terminals()
    made.open('tab-6', process.cwd(), { cols: 80, rows: 24 }, heard.sink)
    made.open('tab-7', process.cwd(), { cols: 80, rows: 24 }, heard.sink)
    expect(made.count()).toBe(2)

    made.close('tab-6')
    expect(made.count()).toBe(1)
    made.write('tab-6', 'echo gone\r')
    made.write('tab-7', 'echo second-still-here\r')

    await until(() => heard.text().includes('second-still-here\r\n'), 'the second shell to answer')
    expect(heard.text()).not.toContain('gone\r\n')
    expect(heard.exits).toHaveLength(0)
  })
})
