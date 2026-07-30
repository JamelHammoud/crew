import { execFile } from 'node:child_process'
import { mkdir, readlink, symlink, unlink } from 'node:fs/promises'
import {
  asAdmin,
  COMMAND_DIR,
  COMMAND_LINK,
  installLine,
  removeLine,
  turnedDown,
  type CommandDone,
  type CommandState
} from '../shared/crewCommand'

// Putting `crew` on PATH, and taking it off again. The file is already on the
// machine, inside the app, so this is one link and nothing is downloaded or
// unpacked.

interface Ran {
  ok: boolean
  message: string
  code: number | null
}

function run(command: string, args: string[]): Promise<Ran> {
  return new Promise(settle => {
    execFile(command, args, (error, _out, err) => {
      if (!error) settle({ ok: true, message: '', code: 0 })
      else settle({ ok: false, message: `${err || ''}${error.message}`, code: error.code ?? null })
    })
  })
}

export class CrewCommand {
  constructor(private readonly script: string | null) {}

  async state(): Promise<CommandState> {
    if (!this.script) return { kind: 'off', where: COMMAND_LINK }
    try {
      const target = await readlink(COMMAND_LINK)
      if (target === this.script) return { kind: 'linked', where: COMMAND_LINK }
      return { kind: 'other', where: target }
    } catch (error) {
      // A link that points at nothing still reads, so the one error left worth
      // telling apart is a real file standing where the link would go.
      if ((error as NodeJS.ErrnoException).code === 'EINVAL') {
        return { kind: 'other', where: COMMAND_LINK }
      }
      return { kind: 'missing', where: COMMAND_LINK }
    }
  }

  async install(): Promise<CommandDone> {
    if (!this.script) return { ok: false, problem: 'There is nothing to install on this machine.' }
    try {
      await mkdir(COMMAND_DIR, { recursive: true })
      await unlink(COMMAND_LINK).catch(() => {})
      await symlink(this.script, COMMAND_LINK)
      return { ok: true }
    } catch {
      return this.ask(installLine(this.script))
    }
  }

  async remove(): Promise<CommandDone> {
    try {
      await unlink(COMMAND_LINK)
      return { ok: true }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true }
      return this.ask(removeLine())
    }
  }

  // Plenty of machines will not let an app write to /usr/local/bin, so the same
  // line is asked for again with a password. Whoever dismisses that dialog is
  // told nothing: they already know what they decided.
  private async ask(line: string): Promise<CommandDone> {
    const ran =
      process.platform === 'darwin'
        ? await run('osascript', ['-e', asAdmin(line)])
        : await run('pkexec', ['sh', '-c', line])
    if (ran.ok) return { ok: true }
    if (turnedDown(ran.message, ran.code)) return { ok: false }
    return { ok: false, problem: `Crew could not write to ${COMMAND_DIR}.` }
  }
}
