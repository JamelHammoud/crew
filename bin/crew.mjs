#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

export const OPEN_FLAG = '--crew-open='

export const HELP = `crew opens a crew in a folder.

Usage
  crew [folder] [options]

Options
  -n, --name <name>   the name you go by
      --in-project    keep the chat, docs and designs in the project
      --in-app        keep them in the Crew app, and write nothing into the project
      --share         let people on your network in
      --no-share      keep it to this machine
  -j, --join <link>   join a crew, and work in this folder
  -h, --help          print this
  -v, --version       print the version

The folder is the one you are in unless you name another. Where a crew lives is
asked once per project and remembered from then on, so --in-project and --in-app
only have anything to say the first time.

CREW_APP points at the Crew to open. Without it the installed app is opened, and
then the one built in this checkout.
`

export function parseArgs(argv, cwd) {
  let folder = null
  let name = ''
  let link = ''
  let home = null
  let share = null
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') return { kind: 'help' }
    if (arg === '-v' || arg === '--version') return { kind: 'version' }
    if (arg === '-n' || arg === '--name') {
      const given = argv[i + 1]
      if (!given || given.startsWith('-')) return { kind: 'error', message: 'crew: --name needs the name you go by.' }
      name = given
      i += 1
      continue
    }
    if (arg === '-j' || arg === '--join') {
      const given = argv[i + 1]
      if (!given || given.startsWith('-')) return { kind: 'error', message: 'crew: --join needs a link.' }
      link = given
      i += 1
      continue
    }
    if (arg === '--in-project') {
      home = 'folder'
      continue
    }
    if (arg === '--in-app') {
      home = 'private'
      continue
    }
    if (arg === '--share') {
      share = true
      continue
    }
    if (arg === '--no-share') {
      share = false
      continue
    }
    if (arg.startsWith('-') && arg !== '-') {
      return { kind: 'error', message: `crew: ${arg} is not one of the options. Try crew --help.` }
    }
    if (folder !== null) return { kind: 'error', message: 'crew: one folder at a time.' }
    folder = arg
  }
  if (link && (home !== null || share !== null)) {
    return {
      kind: 'error',
      message: "crew: --join takes a link and a folder. Where a crew lives and who can reach it is the host's own."
    }
  }
  const request = { folder: path.resolve(cwd, folder ?? '.') }
  if (name) request.name = name
  if (home) request.home = home
  if (share !== null) request.share = share
  if (link) request.link = link
  return { kind: 'open', request }
}

export function openFlag(request) {
  return `${OPEN_FLAG}${JSON.stringify(request)}`
}

function installedApps(platform, env, homeDir) {
  if (platform === 'darwin') {
    return [
      '/Applications/Crew.app/Contents/MacOS/Crew',
      path.join(homeDir, 'Applications', 'Crew.app', 'Contents', 'MacOS', 'Crew')
    ]
  }
  if (platform === 'win32') {
    const found = []
    if (env.LOCALAPPDATA) found.push(path.join(env.LOCALAPPDATA, 'Programs', 'crew', 'Crew.exe'))
    if (env.PROGRAMFILES) found.push(path.join(env.PROGRAMFILES, 'Crew', 'Crew.exe'))
    return found
  }
  return ['/opt/Crew/crew']
}

export function appLaunch(platform, env, homeDir, projectRoot, exists = existsSync) {
  const asked = (env.CREW_APP ?? '').trim()
  if (asked) return { command: asked, args: [] }
  for (const candidate of installedApps(platform, env, homeDir)) {
    if (exists(candidate)) return { command: candidate, args: [] }
  }
  const electron = path.join(projectRoot, 'node_modules', '.bin', platform === 'win32' ? 'electron.cmd' : 'electron')
  if (exists(electron) && exists(path.join(projectRoot, 'out', 'main', 'index.js'))) {
    return { command: electron, args: [projectRoot] }
  }
  return null
}

// The command may be running inside Crew itself, as the app in node's clothing,
// and that is an environment variable rather than a way of being started: handed
// on to the app being opened, it would come up as a node process with no window
// and nobody would ever see it. Everything else about the environment is passed
// on as it stands.
export function childEnv(env) {
  const next = { ...env }
  delete next.ELECTRON_RUN_AS_NODE
  return next
}

function isFolder(target) {
  try {
    return statSync(target).isDirectory()
  } catch {
    return false
  }
}

function version() {
  try {
    return JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version ?? ''
  } catch {
    return ''
  }
}

function main(argv) {
  const parsed = parseArgs(argv, process.cwd())
  if (parsed.kind === 'help') {
    process.stdout.write(HELP)
    return 0
  }
  if (parsed.kind === 'version') {
    process.stdout.write(`${version()}\n`)
    return 0
  }
  if (parsed.kind === 'error') {
    process.stderr.write(`${parsed.message}\n`)
    return 1
  }
  const { request } = parsed
  if (!isFolder(request.folder)) {
    process.stderr.write(`crew: ${request.folder} is not a folder.\n`)
    return 1
  }
  const launch = appLaunch(process.platform, process.env, os.homedir(), root)
  if (!launch) {
    process.stderr.write('crew: no Crew to open. Install the app, run yarn build here, or point CREW_APP at one.\n')
    return 1
  }
  const child = spawn(launch.command, [...launch.args, openFlag(request)], {
    cwd: request.folder,
    detached: true,
    stdio: 'ignore'
  })
  child.on('error', error => {
    process.stderr.write(`crew: ${launch.command} would not start. ${error.message}\n`)
    process.exitCode = 1
  })
  child.unref()
  return 0
}

function launchedDirectly(argv1) {
  if (!argv1) return false
  try {
    return pathToFileURL(realpathSync(argv1)).href === import.meta.url
  } catch {
    return false
  }
}

if (launchedDirectly(process.argv[1])) {
  const code = main(process.argv.slice(2))
  if (code !== 0) process.exitCode = code
}
