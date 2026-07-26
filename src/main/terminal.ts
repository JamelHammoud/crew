import { spawn, type IPty } from 'node-pty'
import { existsSync } from 'node:fs'
import os from 'node:os'

export type TerminalSize = { cols: number; rows: number }

export type TerminalSink = {
  data(id: string, chunk: string): void
  exit(id: string): void
}

type Shell = { file: string; args: string[] }

type Spare = { pty: IPty; folder: string; held: string; ended: boolean }

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

export class Terminals {
  private sessions = new Map<string, IPty>()
  private spare: Spare | null = null
  private lastSize: TerminalSize = FIRST_SIZE

  // A login shell reads the whole profile before it says anything, which is
  // seconds on a machine that loads a version manager, and all of it is spent
  // watching a bare cursor blink. One shell is kept ready from the moment the
  // panel is open, so the tab lands on a prompt that is already there.
  warm(folder: string | null): void {
    const where = startingFolder(folder)
    if (this.spare && !this.spare.ended && this.spare.folder === where) return
    this.cool()
    let pty: IPty
    try {
      pty = this.start(where, this.lastSize)
    } catch {
      return
    }
    const spare: Spare = { pty, folder: where, held: '', ended: false }
    this.spare = spare
    pty.onData(chunk => {
      if (this.spare !== spare || spare.held.length > HELD_LIMIT) return
      spare.held += chunk
    })
    pty.onExit(() => {
      spare.ended = true
      if (this.spare === spare) this.spare = null
    })
  }

  open(id: string, folder: string | null, wanted: TerminalSize, sink: TerminalSink): void {
    if (this.sessions.has(id)) return
    const where = startingFolder(folder)
    this.lastSize = wanted
    const ready = this.claim(where)
    if (ready) {
      this.hold(id, ready.pty, sink)
      if (ready.held) sink.data(id, ready.held)
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

  // A shell warmed for one project folder is no use to another, and one that
  // has already ended is no use to anybody.
  private claim(folder: string): Spare | null {
    const spare = this.spare
    if (!spare || spare.ended || spare.folder !== folder) return null
    this.spare = null
    return spare
  }

  private cool(): void {
    const spare = this.spare
    this.spare = null
    spare?.pty.kill()
  }

  private hold(id: string, pty: IPty, sink: TerminalSink): void {
    this.sessions.set(id, pty)
    pty.onData(chunk => {
      const holder = this.sessions.get(id)
      if (holder && holder !== pty) return
      sink.data(id, chunk)
    })
    // A shell that was already closed is nobody's business when it finally
    // ends. A tab reopened under the same name has a shell of its own by
    // then, and taking the old one's word for it would strike the new one
    // off and leave a terminal that prints but never listens.
    pty.onExit(() => {
      if (this.sessions.get(id) !== pty) return
      this.sessions.delete(id)
      sink.exit(id)
    })
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.write(data)
  }

  resize(id: string, wanted: TerminalSize): void {
    this.sessions.get(id)?.resize(size(wanted.cols), size(wanted.rows))
  }

  close(id: string): void {
    const pty = this.sessions.get(id)
    if (!pty) return
    this.sessions.delete(id)
    pty.kill()
  }

  closeAll(): void {
    for (const id of [...this.sessions.keys()]) this.close(id)
    this.cool()
  }

  count(): number {
    return this.sessions.size
  }

  ready(): boolean {
    return !!this.spare && !this.spare.ended && this.spare.held.length > 0
  }
}
