import path from 'node:path'

// Where the `crew` command goes, and which file it points at. The app ships the
// command inside itself, so putting it on PATH is one link rather than an
// install of its own.

export const COMMAND_DIR = '/usr/local/bin'
export const COMMAND_LINK = `${COMMAND_DIR}/crew`

export type CommandKind = 'off' | 'missing' | 'linked' | 'other'

export interface CommandState {
  kind: CommandKind
  // Where it is, or what is standing in its place.
  where: string
}

export interface CommandDone {
  ok: boolean
  // Absent where somebody turned it down themselves, since a password dialog
  // dismissed on purpose is not news.
  problem?: string
}

export interface CommandPlace {
  platform: string
  fromSource: boolean
  appPath: string
  resourcesPath: string
}

// Windows has no folder every shell already reads, so the file ships there and
// nothing is linked. Everywhere else /usr/local/bin is the one place a command
// goes.
export function shipsCommand(platform: string): boolean {
  return platform !== 'win32'
}

// A packaged app carries the command beside its own resources, as a shell
// script that runs the app itself as node, so the machine it lands on needs no
// node of its own. A run from source has the checkout to point at instead.
export function commandScript(place: CommandPlace): string | null {
  if (!shipsCommand(place.platform)) return null
  if (place.fromSource) return path.join(place.appPath, 'bin', 'crew.mjs')
  return path.join(place.resourcesPath, 'cli', 'bin', 'crew')
}

// One word to a shell, whatever it is made of. A folder with a space or an
// apostrophe in it is an ordinary folder, and the line below is handed to sh.
export function shellWord(text: string): string {
  return `'${text.split("'").join(`'\\''`)}'`
}

const quoted = shellWord

export function installLine(script: string): string {
  return `mkdir -p ${quoted(COMMAND_DIR)} && ln -sf ${quoted(script)} ${quoted(COMMAND_LINK)}`
}

export function removeLine(): string {
  return `rm -f ${quoted(COMMAND_LINK)}`
}

// The same line again, asked for with an admin password, for the machines whose
// /usr/local/bin nobody may write to without one.
export function asAdmin(line: string): string {
  const inside = line.split('\\').join('\\\\').split('"').join('\\"')
  return `do shell script "${inside}" with administrator privileges`
}

// Somebody dismissing the password dialog is a decision rather than a failure,
// so it is told apart here and said nothing about. osascript answers -128 for
// it, and pkexec 126.
export function turnedDown(message: string, code: number | null): boolean {
  return code === 126 || /-128|User cancell?ed/i.test(message)
}
