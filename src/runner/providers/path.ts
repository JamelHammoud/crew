import { spawnSync } from 'node:child_process'
import { accessSync, constants, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'

const MARKER = '__CREW_PATH__'

const HOME_DIRS = [
  '.local/bin',
  '.claude/local',
  '.kimi-code/bin',
  '.codex/bin',
  '.grok/bin',
  '.bun/bin',
  '.deno/bin',
  '.cargo/bin',
  '.volta/bin',
  '.npm-global/bin',
  'bin'
]

const SYSTEM_DIRS = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']

function nodeVersionDirs(home: string): string[] {
  const root = join(home, '.nvm/versions/node')
  try {
    return readdirSync(root).map(entry => join(root, entry, 'bin'))
  } catch {
    return []
  }
}

let shellDirs: string[] | null = null

function loginShellDirs(): string[] {
  if (shellDirs) return shellDirs
  shellDirs = []
  const shell = process.env.SHELL
  if (shell && process.platform !== 'win32') {
    const result = spawnSync(shell, ['-ilc', `echo ${MARKER}$PATH`], { encoding: 'utf8', timeout: 5000 })
    const line = (result.stdout ?? '').split('\n').find(l => l.includes(MARKER))
    if (line) shellDirs = line.slice(line.indexOf(MARKER) + MARKER.length).trim().split(delimiter)
  }
  return shellDirs
}

export function searchDirs(
  options: { home?: string; path?: string; loginShell?: boolean } = {}
): string[] {
  const home = options.home ?? process.env.HOME ?? homedir()
  const all = [
    ...(options.path ?? process.env.PATH ?? '').split(delimiter),
    ...(options.loginShell === false ? [] : loginShellDirs()),
    ...HOME_DIRS.map(dir => join(home, dir)),
    ...nodeVersionDirs(home),
    ...SYSTEM_DIRS
  ]
  return [...new Set(all.filter(Boolean))]
}

export function crewPath(dirs: string[] = searchDirs()): string {
  return dirs.join(delimiter)
}

function commandCandidates(command: string): string[] {
  if (process.platform !== 'win32') return [command]
  const exts = (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
  const hasExt = exts.some(ext => command.toLowerCase().endsWith(ext.toLowerCase()))
  if (hasExt) return [command]
  return [...exts.map(ext => command + ext.toLowerCase()), command]
}

export function resolveCommand(command: string, dirs: string[] = searchDirs()): string | null {
  if (command.includes('/') || command.includes('\\')) return command
  const candidates = commandCandidates(command)
  for (const dir of dirs) {
    for (const name of candidates) {
      const candidate = join(dir, name)
      try {
        if (!statSync(candidate).isFile()) continue
        if (process.platform !== 'win32') accessSync(candidate, constants.X_OK)
        return candidate
      } catch {
        continue
      }
    }
  }
  return null
}
