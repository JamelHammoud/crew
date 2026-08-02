import { spawn } from 'node:child_process'
import { detachCliProcess } from './cli'
import { resolveCommand } from './path'

export interface LocalRuntime {
  url: string
  label: string
  kind: 'ollama' | 'openai'
}

const OLLAMA_PORT = 11434

const DEFAULT_URLS = [
  `http://127.0.0.1:${OLLAMA_PORT}`,
  'http://127.0.0.1:1234',
  'http://127.0.0.1:8080'
]

const SERVERS: Record<string, string> = {
  [String(OLLAMA_PORT)]: 'Ollama',
  '1234': 'LM Studio',
  '8080': 'llama-server'
}

const PROBE_MS = 1500
const START_MS = 8000
const POLL_MS = 300
const POLL_PROBE_MS = 500

let found: LocalRuntime[] = []

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function fullUrl(said: string): string | null {
  const written = said.trim().replace(/\/+$/, '')
  if (!written) return null
  const withScheme = /^https?:\/\//i.test(written) ? written : `http://${written}`
  const url = parse(withScheme)
  if (!url) return null
  const authority = withScheme.slice(withScheme.indexOf('://') + 3).split('/')[0]
  if (!/:\d+$/.test(authority)) url.port = String(OLLAMA_PORT)
  return `${url.protocol}//${url.host}`
}

function labelOf(url: string, kind: LocalRuntime['kind']): string {
  if (kind === 'ollama') return 'Ollama'
  const at = parse(url)
  if (!at) return url
  return SERVERS[at.port] ?? at.host
}

async function reaches(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const answer = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    try {
      await answer.body?.cancel()
    } catch {
      /* nothing to give back */
    }
    return answer.ok
  } catch {
    return false
  }
}

export function candidateUrls(env: NodeJS.ProcessEnv = process.env): string[] {
  const said = env.OLLAMA_HOST ? fullUrl(env.OLLAMA_HOST) : null
  return [...new Set([...(said ? [said] : []), ...DEFAULT_URLS])]
}

export async function answering(url: string, timeoutMs = PROBE_MS): Promise<LocalRuntime | null> {
  if (await reaches(`${url}/api/tags`, timeoutMs)) return { url, label: labelOf(url, 'ollama'), kind: 'ollama' }
  if (await reaches(`${url}/v1/models`, timeoutMs)) return { url, label: labelOf(url, 'openai'), kind: 'openai' }
  return null
}

export async function findRuntimes(): Promise<LocalRuntime[]> {
  const answers = await Promise.all(candidateUrls().map(url => answering(url)))
  found = answers.filter((one): one is LocalRuntime => one !== null)
  return found
}

export function cachedRuntimes(): LocalRuntime[] {
  return found
}

function rest(ms: number): Promise<void> {
  return new Promise(done => setTimeout(done, ms))
}

async function waitsFor(url: string): Promise<boolean> {
  const until = Date.now() + START_MS
  while (Date.now() < until) {
    await rest(POLL_MS)
    if (await answering(url, POLL_PROBE_MS)) return true
  }
  return false
}

export async function ensureServing(url: string): Promise<boolean> {
  if (await answering(url)) return true
  const command = resolveCommand('ollama')
  if (!command) return false
  const at = parse(url)
  try {
    const child = spawn(command, ['serve'], {
      detached: detachCliProcess(),
      stdio: 'ignore',
      env: { ...process.env, ...(at ? { OLLAMA_HOST: at.host } : {}) }
    })
    child.on('error', () => {})
    child.unref()
  } catch {
    return false
  }
  return waitsFor(url)
}
