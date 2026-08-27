import { spawn, type IPty } from 'node-pty'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import { foregroundOn } from '../shared/terminalName'

export type TerminalSize = { cols: number; rows: number }

export type TerminalSink = {
  data(id: string, chunk: string): void
  exit(id: string): void
  running(id: string, command: string): void
}

type Shell = { file: string; args: string[] }

type Spare = { pty: IPty; folder: string; held: string; ended: boolean }

type Live = { pty: IPty; tty: string; sink: TerminalSink; running: string }

// The shell a terminal on this machine would open, started the way Terminal
// and Windows Terminal start it: the login shell, so it reads the same
// profile and arrives with the same PATH.
export function shellFor(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): Shell {
  if (platform === 'win32') {
    const root = env['SystemRoot'] || 'C:\\Windows'
    return { file: `${root}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`, args: [] }
  }
  return { file: env['SHELL'] || (platform === 'darwin' ? '/bin/zsh' : '/bin/bash'), args: ['-l'] }
}

// crew is started from a dock icon or from yarn, and both leave marks on the
// environment that a shell opened from the desktop would never carry.
export function terminalEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const clean: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue
    if (key.startsWith('npm_') || key.startsWith('ELECTRON_')) continue
    if (key === 'NODE_ENV' || key === 'NODE_OPTIONS' || key === 'INIT_CWD') continue
    clean[key] = value
  }
  clean['TERM'] = 'xterm-256color'
  clean['COLORTERM'] = 'truecolor'
  clean['TERM_PROGRAM'] = 'crew'
  return clean
}

export function startingFolder(folder: string | null): string {
  return folder && existsSync(folder) ? folder : os.homedir()
}

// A shell kept ready draws its prompt into a terminal of its own size, and zsh
// pads that line out to the width it believes it has before returning to the
// start of it. Replayed into a tab of another size the padding lands somewhere
// else and the end of line mark it left is still on screen. Only what follows
// the last carriage return of a line was ever meant to be read, which is what
// the terminal would have been showing had it been there from the start.
export function replayable(held: string): string {
  return held
    .split('\r\n')
    .map(line => line.slice(line.lastIndexOf('\r') + 1))
    .join('\r\n')
}

const size = (value: number): number => (Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1)

const FIRST_SIZE: TerminalSize = { cols: 80, rows: 24 }

const HELD_LIMIT = 64 * 1024

const SPARE_LIMIT = 2

// What is running is read for every terminal at once, off one ps, and the next
// read is armed once the last has settled rather than on a clock: a machine
// that answers slowly would otherwise be handed a queue that only ever grows.
const WATCH_MS = 1000

// A command line has no ceiling and this one is read a second, so a pathological
// one is cut here rather than carried into the window and written down.
const PS_LIMIT = 256 * 1024

// The pty's own slave device, which is what says which rows of ps are its own.
// It is not in node-pty's typings and there is nothing on Windows it could be.
const ttyOf = (pty: IPty): string => String((pty as unknown as { ptsName?: string }).ptsName ?? '')

function readPs(): Promise<string> {
  return new Promise(done => {
    execFile('ps', ['-ao', 'tty=,stat=,pid=,args='], { maxBuffer: PS_LIMIT }, (error, out) => done(error ? '' : out))
  })
}

const standing = (spare: Spare): boolean => !spare.ended && spare.held.length > 0

export class Terminals {
  private sessions = new Map<string, Live>()
  private spares = new Map<string, Spare>()
  private lastSize: TerminalSize = FIRST_SIZE
  private watching: NodeJS.Timeout | null = null
  private reading = false

  warm(folder: string | null): void {
    const where = startingFolder(folder)
    const already = this.spares.get(where)
    if (already && !already.ended) {
      this.touch(where, already)
      return
    }
    this.drop(where)
    let pty: IPty
    try {
      pty = this.start(where, this.lastSize)
    } catch {
      return
    }
    const spare: Spare = { pty, folder: where, held: '', ended: false }
    this.touch(where, spare)
    this.evict()
    pty.onData(chunk => {
      if (this.spares.get(where) !== spare || spare.held.length > HELD_LIMIT) return
      spare.held += chunk
    })
    pty.onExit(() => {
      spare.ended = true
      if (this.spares.get(where) === spare) this.spares.delete(where)
    })
  }

  open(id: string, folder: string | null, wanted: TerminalSize, sink: TerminalSink): void {
    if (this.sessions.has(id)) return
    const where = startingFolder(folder)
    this.lastSize = wanted
    const ready = this.claim(where)
    if (ready) {
      this.hold(id, ready.pty, sink)
      const seen = replayable(ready.held)
      if (seen) sink.data(id, seen)
      this.resize(id, wanted)
      this.warm(folder)
      return
    }
    try {
      this.hold(id, this.start(where, wanted), sink)
    } catch (error) {
      sink.data(id, `${shellFor(process.platform, process.env).file}: ${(error as Error).message}\r\n`)
      sink.exit(id)
    }
    this.warm(folder)
  }

  private start(folder: string, wanted: TerminalSize): IPty {
    const shell = shellFor(process.platform, process.env)
    return spawn(shell.file, shell.args, {
      name: 'xterm-256color',
      cols: size(wanted.cols),
      rows: size(wanted.rows),
      cwd: folder,
      env: terminalEnv(process.env)
    })
  }

  private claim(folder: string): Spare | null {
    const spare = this.spares.get(folder)
    if (!spare || spare.ended) return null
    this.spares.delete(folder)
    return spare
  }

  private touch(folder: string, spare: Spare): void {
    this.spares.delete(folder)
    this.spares.set(folder, spare)
  }

  private evict(): void {
    while (this.spares.size > SPARE_LIMIT) {
      const oldest = this.spares.keys().next()
      if (oldest.done) return
      this.drop(oldest.value)
    }
  }

  private drop(folder: string): void {
    const spare = this.spares.get(folder)
    if (!spare) return
    this.spares.delete(folder)
    spare.pty.kill()
  }

  private cool(): void {
    for (const folder of [...this.spares.keys()]) this.drop(folder)
  }

  private hold(id: string, pty: IPty, sink: TerminalSink): void {
    this.sessions.set(id, { pty, tty: ttyOf(pty), sink, running: '' })
    this.watch()
    pty.onData(chunk => {
      const holder = this.sessions.get(id)
      if (holder && holder.pty !== pty) return
      sink.data(id, chunk)
    })
    // A shell that was already closed is nobody's business when it finally
    // ends. A tab reopened under the same name has a shell of its own by
    // then, and taking the old one's word for it would strike the new one
    // off and leave a terminal that prints but never listens.
    pty.onExit(() => {
      if (this.sessions.get(id)?.pty !== pty) return
      this.sessions.delete(id)
      sink.exit(id)
    })
  }

  // A terminal says what is going on in it, so the tab standing over five of
  // them says five different things. Nothing is read while nothing is open, and
  // a reading that has not moved is never sent.
  private watch(): void {
    if (this.watching || this.reading || this.sessions.size === 0) return
    if (process.platform === 'win32') return
    this.watching = setTimeout(() => {
      this.watching = null
      void this.read()
    }, WATCH_MS)
    this.watching.unref?.()
  }

  private async read(): Promise<void> {
    if (this.sessions.size === 0) return
    this.reading = true
    const ps = await readPs()
    this.reading = false
    for (const [id, live] of this.sessions) {
      const running = ps ? foregroundOn(ps, live.tty, live.pty.pid) : ''
      if (running === live.running) continue
      live.running = running
      live.sink.running(id, running)
    }
    this.watch()
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.pty.write(data)
  }

  resize(id: string, wanted: TerminalSize): void {
    this.sessions.get(id)?.pty.resize(size(wanted.cols), size(wanted.rows))
  }

  close(id: string): void {
    const live = this.sessions.get(id)
    if (!live) return
    this.sessions.delete(id)
    live.pty.kill()
  }

  closeAll(): void {
    for (const id of [...this.sessions.keys()]) this.close(id)
    if (this.watching) clearTimeout(this.watching)
    this.watching = null
    this.cool()
  }

  count(): number {
    return this.sessions.size
  }

  ready(folder?: string): boolean {
    if (folder === undefined) {
      for (const spare of this.spares.values()) if (standing(spare)) return true
      return false
    }
    const spare = this.spares.get(startingFolder(folder))
    return !!spare && standing(spare)
  }
}
