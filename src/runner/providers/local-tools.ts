import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { listRepoFiles } from '../../shared/repoFiles'
import { resolveCommand } from './path'

export interface ToolSpec {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export interface ToolResult {
  output: string
  ok: boolean
}

const READ_CHARS = 60000
const BASH_CHARS = 30000
const BASH_TIMEOUT_MS = 120000
const BASH_CEILING_MS = 600000
const BASH_BUFFER = 16 * 1024 * 1024
const GREP_HITS = 200
const GREP_LINE_CHARS = 400
const GREP_FILES = 5000
const GLOB_HITS = 300
const LS_ENTRIES = 500

const spec = (name: string, description: string, properties: Record<string, unknown>, required: string[]): ToolSpec => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } }
})

const text = (description: string): Record<string, unknown> => ({ type: 'string', description })
const count = (description: string): Record<string, unknown> => ({ type: 'number', description })
const flag = (description: string): Record<string, unknown> => ({ type: 'boolean', description })

export const LOCAL_TOOLS: ToolSpec[] = [
  spec(
    'Read',
    'Read a file off this machine. Relative paths are read from the project folder. Returns the text as it stands, with no line numbers.',
    {
      file_path: text('The file to read.'),
      offset: count('The line to start at, counting from 1. Leave out to start at the top.'),
      limit: count('How many lines to read. Leave out to read to the end.')
    },
    ['file_path']
  ),
  spec(
    'Write',
    'Write a file, replacing whatever was there. Folders along the way are made as needed. Read a file before rewriting it.',
    { file_path: text('The file to write.'), content: text('The whole of what the file should hold.') },
    ['file_path', 'content']
  ),
  spec(
    'Edit',
    'Replace an exact stretch of text in a file. old_string has to appear once, so give enough of the lines around it to be unambiguous, or set replace_all.',
    {
      file_path: text('The file to change.'),
      old_string: text('The text to replace, exactly as it stands in the file.'),
      new_string: text('The text to put in its place.'),
      replace_all: flag('Replace every occurrence rather than the one.')
    },
    ['file_path', 'old_string', 'new_string']
  ),
  spec(
    'Bash',
    'Run a command in the shell, in the project folder. Returns what it printed, output and errors together.',
    {
      command: text('The command to run.'),
      description: text('A few words saying what it does.'),
      timeout: count('How long to give it, in milliseconds. Two minutes by default.')
    },
    ['command']
  ),
  spec(
    'Grep',
    'Search the project for a regular expression. Returns the file, the line number and the line.',
    {
      pattern: text('The regular expression to look for.'),
      path: text('A file or folder to search. The project folder by default.'),
      glob: text('Only search files whose path matches this, like *.ts.')
    },
    ['pattern']
  ),
  spec(
    'Glob',
    'Find files by path. ** matches any folders, * matches anything within one name, ? matches one character.',
    { pattern: text('The pattern to match, like **/*.ts.'), path: text('The folder to search. The project folder by default.') },
    ['pattern']
  ),
  spec('LS', 'List what is in a folder, saying which entries are folders.', { path: text('The folder to list. The project folder by default.') }, []),
  spec(
    'TodoWrite',
    'Publish the list of what you are doing. Send the whole list every time, with one item in progress at most.',
    {
      todos: {
        type: 'array',
        description: 'The whole list, in order.',
        items: {
          type: 'object',
          properties: {
            content: text('The task, named: "Draw the rows".'),
            activeForm: text('The same task, narrated: "Drawing the rows".'),
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'Where the task has got to.' }
          },
          required: ['content', 'activeForm', 'status']
        }
      }
    },
    ['todos']
  )
]

const ok = (output: string): ToolResult => ({ output, ok: true })
const bad = (output: string): ToolResult => ({ output, ok: false })

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

const truthy = (value: unknown): boolean => value === true || value === 'true'

const at = (cwd: string, target: string): string => (path.isAbsolute(target) ? path.resolve(target) : path.resolve(cwd, target))

const cut = (body: string, limit: number): string =>
  body.length > limit ? `${body.slice(0, limit)}\n\n[Cut here. That is the first ${limit} of ${body.length} characters.]` : body

async function readText(file: string): Promise<string> {
  const stat = await fs.stat(file)
  if (stat.isDirectory()) throw new Error(`${file} is a folder, not a file. LS lists what is in it.`)
  return fs.readFile(file, 'utf8')
}

async function toolRead(args: Record<string, unknown>, cwd: string): Promise<ToolResult> {
  const target = str(args['file_path'])
  if (!target) return bad('Read needs a file_path.')
  const file = at(cwd, target)
  try {
    const body = await readText(file)
    const offset = num(args['offset'])
    const limit = num(args['limit'])
    if (offset === undefined && limit === undefined) {
      return ok(body === '' ? `${target} is empty.` : cut(body, READ_CHARS))
    }
    const lines = body.split('\n')
    const from = Math.max(0, (offset ?? 1) - 1)
    if (from >= lines.length) return bad(`${target} has ${lines.length} lines, so there is nothing at line ${from + 1}.`)
    const taken = lines.slice(from, limit === undefined ? undefined : from + Math.max(0, limit))
    return ok(cut(taken.join('\n'), READ_CHARS))
  } catch (error) {
    return bad(reason(error))
  }
}

async function toolWrite(args: Record<string, unknown>, cwd: string): Promise<ToolResult> {
  const target = str(args['file_path'])
  if (!target) return bad('Write needs a file_path.')
  if (typeof args['content'] !== 'string') return bad('Write needs content, as a string.')
  const body = args['content']
  const file = at(cwd, target)
  try {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, body, 'utf8')
    const lines = body === '' ? 0 : body.split('\n').length
    return ok(`Wrote ${lines} ${lines === 1 ? 'line' : 'lines'} to ${target}.`)
  } catch (error) {
    return bad(reason(error))
  }
}

async function toolEdit(args: Record<string, unknown>, cwd: string): Promise<ToolResult> {
  const target = str(args['file_path'])
  if (!target) return bad('Edit needs a file_path.')
  const before = str(args['old_string'])
  if (!before) return bad('Edit needs an old_string to look for.')
  if (typeof args['new_string'] !== 'string') return bad('Edit needs a new_string, as a string.')
  const after = args['new_string']
  if (before === after) return bad('old_string and new_string are the same, so there is nothing to change.')
  const all = truthy(args['replace_all'])
  const file = at(cwd, target)
  try {
    const body = await readText(file)
    const parts = body.split(before)
    const hits = parts.length - 1
    if (hits === 0) return bad(`That old_string is not in ${target}. Read the file and copy the lines exactly as they stand.`)
    if (hits > 1 && !all) {
      return bad(
        `That old_string appears ${hits} times in ${target}. Take in more of the lines around it so it matches once, or set replace_all to true.`
      )
    }
    const written = all ? parts.join(after) : body.slice(0, body.indexOf(before)) + after + body.slice(body.indexOf(before) + before.length)
    await fs.writeFile(file, written, 'utf8')
    return ok(all && hits > 1 ? `Replaced ${hits} occurrences in ${target}.` : `Edited ${target}.`)
  } catch (error) {
    return bad(reason(error))
  }
}

function loginShell(): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    const root = process.env['SystemRoot'] || 'C:\\Windows'
    return { file: `${root}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`, args: ['-NoProfile', '-Command'] }
  }
  return { file: process.env['SHELL'] || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'), args: ['-lc'] }
}

interface Ran {
  out: string
  code: number
  timedOut: boolean
}

function runShell(command: string, cwd: string, timeout: number): Promise<Ran> {
  const shell = loginShell()
  return new Promise(resolve => {
    execFile(shell.file, [...shell.args, command], { cwd, timeout, maxBuffer: BASH_BUFFER }, (error, stdout, stderr) => {
      const out = [stdout, stderr].filter(Boolean).join('')
      const failure = error as (Error & { code?: number; killed?: boolean; signal?: string }) | null
      resolve({
        out,
        code: failure ? (typeof failure.code === 'number' ? failure.code : 1) : 0,
        timedOut: Boolean(failure?.killed || failure?.signal)
      })
    })
  })
}

async function toolBash(args: Record<string, unknown>, cwd: string): Promise<ToolResult> {
  const command = str(args['command'])
  if (!command.trim()) return bad('Bash needs a command.')
  const asked = num(args['timeout'])
  const timeout = Math.min(asked && asked > 0 ? asked : BASH_TIMEOUT_MS, BASH_CEILING_MS)
  try {
    const ran = await runShell(command, cwd, timeout)
    const body = cut(ran.out, BASH_CHARS)
    if (ran.timedOut) return bad(`${body}\n\nStopped after ${timeout}ms.`.trim())
    if (ran.code !== 0) return bad(`${body}\n\nExited with code ${ran.code}.`.trim())
    return ok(body || 'The command printed nothing.')
  } catch (error) {
    return bad(reason(error))
  }
}

function globToRegExp(pattern: string): RegExp {
  let source = ''
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index]
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        index++
        if (pattern[index + 1] === '/') {
          index++
          source += '(?:.*/)?'
        } else source += '.*'
      } else source += '[^/]*'
    } else if (char === '?') source += '[^/]'
    else source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${source}$`)
}

const clip = (line: string): string => (line.length > GREP_LINE_CHARS ? `${line.slice(0, GREP_LINE_CHARS)}…` : line)

async function searchRoot(cwd: string, target: string): Promise<{ root: string; file: string | null }> {
  const absolute = at(cwd, target)
  const stat = await fs.stat(absolute)
  return stat.isDirectory() ? { root: absolute, file: null } : { root: path.dirname(absolute), file: absolute }
}

function ripgrep(pattern: string, target: string, glob: string, cwd: string): Promise<Ran> {
  const rg = null as string | null
  if (!rg) return Promise.resolve({ out: '', code: -1, timedOut: false })
  const args = ['--line-number', '--no-heading', '--color=never', ...(glob ? ['-g', glob] : []), '-e', pattern, target]
  return new Promise(resolve => {
    execFile(rg, args, { cwd, timeout: BASH_TIMEOUT_MS, maxBuffer: BASH_BUFFER }, (error, stdout) => {
      const failure = error as (Error & { code?: number }) | null
      resolve({ out: stdout, code: failure ? (typeof failure.code === 'number' ? failure.code : 1) : 0, timedOut: false })
    })
  })
}

async function grepByHand(pattern: string, cwd: string, target: string, glob: string): Promise<string[]> {
  const found = await searchRoot(cwd, target)
  const test = new RegExp(pattern)
  const match = glob ? globToRegExp(glob) : null
  const files = found.file ? [path.relative(found.root, found.file)] : await listRepoFiles(found.root)
  const hits: string[] = []
  for (const file of files.slice(0, GREP_FILES)) {
    if (hits.length >= GREP_HITS) break
    if (match && !match.test(file)) continue
    const body = await fs.readFile(path.join(found.root, file)).catch(() => null)
    if (!body || body.subarray(0, 8000).includes(0)) continue
    const lines = body.toString('utf8').split('\n')
    for (let index = 0; index < lines.length && hits.length < GREP_HITS; index++) {
      if (test.test(lines[index])) hits.push(`${file}:${index + 1}:${clip(lines[index])}`)
    }
  }
  return hits
}

async function toolGrep(args: Record<string, unknown>, cwd: string): Promise<ToolResult> {
  const pattern = str(args['pattern'])
  if (!pattern) return bad('Grep needs a pattern.')
  const target = str(args['path']) || '.'
  const glob = str(args['glob'])
  try {
    new RegExp(pattern)
  } catch (error) {
    return bad(`That pattern is not a regular expression: ${reason(error)}`)
  }
  try {
    const ran = await ripgrep(pattern, target, glob, cwd)
    const hits =
      ran.code >= 0
        ? ran.out.split('\n').filter(Boolean).map(clip)
        : await grepByHand(pattern, cwd, target, glob)
    if (hits.length === 0) return ok(`No matches for ${pattern}.`)
    const kept = hits.slice(0, GREP_HITS)
    const more = hits.length > kept.length ? `\n\n[Cut here. The first ${GREP_HITS} matches are above.]` : ''
    return ok(kept.join('\n') + more)
  } catch (error) {
    return bad(reason(error))
  }
}

async function toolGlob(args: Record<string, unknown>, cwd: string): Promise<ToolResult> {
  const pattern = str(args['pattern'])
  if (!pattern) return bad('Glob needs a pattern.')
  const target = str(args['path'])
  try {
    const root = at(cwd, target || '.')
    const match = globToRegExp(pattern)
    const found = (await listRepoFiles(root)).filter(file => match.test(file))
    if (found.length === 0) return ok(`Nothing matches ${pattern}.`)
    const kept = found.slice(0, GLOB_HITS).map(file => (target ? `${target.replace(/\/+$/, '')}/${file}` : file))
    const more = found.length > kept.length ? `\n\n[Cut here. The first ${GLOB_HITS} of ${found.length} are above.]` : ''
    return ok(kept.join('\n') + more)
  } catch (error) {
    return bad(reason(error))
  }
}

async function toolLs(args: Record<string, unknown>, cwd: string): Promise<ToolResult> {
  const target = str(args['path']) || '.'
  try {
    const dirents = await fs.readdir(at(cwd, target), { withFileTypes: true })
    const entries = dirents
      .map(entry => ({ name: entry.name, dir: entry.isDirectory() }))
      .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
    if (entries.length === 0) return ok(`${target} is empty.`)
    const kept = entries.slice(0, LS_ENTRIES).map(entry => (entry.dir ? `${entry.name}/` : entry.name))
    const more = entries.length > kept.length ? `\n\n[Cut here. The first ${LS_ENTRIES} of ${entries.length} are above.]` : ''
    return ok(kept.join('\n') + more)
  } catch (error) {
    return bad(reason(error))
  }
}

async function toolTodoWrite(args: Record<string, unknown>): Promise<ToolResult> {
  const todos = args['todos']
  if (!Array.isArray(todos)) return bad('TodoWrite needs todos, as an array.')
  return ok(`Noted, ${todos.length} ${todos.length === 1 ? 'task' : 'tasks'}.`)
}

type Doing = (args: Record<string, unknown>, cwd: string) => Promise<ToolResult>

const DOING: Record<string, Doing> = {
  Read: toolRead,
  Write: toolWrite,
  Edit: toolEdit,
  Bash: toolBash,
  Grep: toolGrep,
  Glob: toolGlob,
  LS: toolLs,
  TodoWrite: toolTodoWrite
}

const BY_LOWER: Record<string, Doing> = Object.fromEntries(Object.entries(DOING).map(([name, run]) => [name.toLowerCase(), run]))

export async function runTool(name: string, args: Record<string, unknown>, cwd: string): Promise<ToolResult> {
  const run = DOING[name] ?? BY_LOWER[(name ?? '').toLowerCase()]
  if (!run) return bad(`There is no tool called ${name}. The ones there are: ${Object.keys(DOING).join(', ')}.`)
  try {
    return await run(args && typeof args === 'object' ? args : {}, cwd)
  } catch (error) {
    return bad(reason(error))
  }
}
