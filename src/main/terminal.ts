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

const size = (value: number): number => (Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1)

export class Terminals {
  private sessions = new Map<string, IPty>()

  open(id: string, folder: string | null, wanted: TerminalSize, sink: TerminalSink): void {
    if (this.sessions.has(id)) return
    const shell = shellFor(process.platform, process.env)
    try {
      const pty = spawn(shell.file, shell.args, {
        name: 'xterm-256color',
        cols: size(wanted.cols),
        rows: size(wanted.rows),
        cwd: startingFolder(folder),
        env: terminalEnv(process.env)
      })
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
    } catch (error) {
      sink.data(id, `${shell.file}: ${(error as Error).message}\r\n`)
      sink.exit(id)
    }
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
  }

  count(): number {
    return this.sessions.size
  }
}
