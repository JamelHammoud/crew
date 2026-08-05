import { spawn } from 'node:child_process'
import { openaiUrl, serverLabel, type ModelServer } from '../../shared/modelServers'
import { detachCliProcess } from './cli'
import { knownServers, serverKey } from './local-servers'
import { resolveCommand } from './path'

export interface LocalRuntime {
  url: string
  label: string
  kind: 'ollama' | 'openai'
  key?: string
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

const here = (host: string): boolean => host === '127.0.0.1' || host === 'localhost' || host === '[::1]'

// What runs on a port is only worth naming where the port is this machine's.
// A server somewhere else on 1234 is not LM Studio, it is whatever somebody
// stood up there, and the address is the only true thing to call it.
function labelOf(url: string, kind: LocalRuntime['kind']): string {
  const at = parse(url)
  if (!at) return url
  if (!here(at.hostname)) return serverLabel(url)
  if (kind === 'ollama') return 'Ollama'
  return SERVERS[at.port] ?? at.host
}

interface Reached {
  ok: boolean
  status: number
}

async function reaches(url: string, timeoutMs: number, key?: string): Promise<Reached> {
  try {
    const answer = await fetch(url, {
      headers: key ? { authorization: `Bearer ${key}` } : undefined,
      signal: AbortSignal.timeout(timeoutMs)
    })
    await answer.body?.cancel().catch(() => undefined)
    return { ok: answer.ok, status: answer.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

const guarded = (status: number): boolean => status === 401 || status === 403

export function candidateUrls(env: NodeJS.ProcessEnv = process.env): string[] {
  const said = env.OLLAMA_HOST ? fullUrl(env.OLLAMA_HOST) : null
  const written = knownServers().map(server => server.url)
  return [...new Set([...(said ? [said] : []), ...DEFAULT_URLS, ...written])]
}

// A server that turns the key away is a server, and saying nothing answered
// there sends somebody to look at the address rather than at the key. So what
// stands in the way is carried back beside the answer.
export async function probeServer(
  url: string,
  key?: string,
  timeoutMs = PROBE_MS
): Promise<{ runtime: LocalRuntime | null; why?: string }> {
  const tags = await reaches(`${url}/api/tags`, timeoutMs, key)
  if (tags.ok) return { runtime: { url, label: labelOf(url, 'ollama'), kind: 'ollama', ...(key ? { key } : {}) } }
  const models = await reaches(openaiUrl(url, '/models'), timeoutMs, key)
  if (models.ok) return { runtime: { url, label: labelOf(url, 'openai'), kind: 'openai', ...(key ? { key } : {}) } }
  if (guarded(models.status) || guarded(tags.status)) {
    return { runtime: null, why: key ? 'That server did not take the key.' : 'That server wants a key.' }
  }
  const mine = here(parse(url)?.hostname ?? '')
  return {
    runtime: null,
    why: `Nothing answered at ${serverLabel(url)}.${mine ? ' Start it and say that again.' : ''}`
  }
}

export async function answering(
  url: string,
  timeoutMs = PROBE_MS,
  key = serverKey(url)
): Promise<LocalRuntime | null> {
  return (await probeServer(url, key, timeoutMs)).runtime
}

export async function checkServer(
  server: ModelServer
): Promise<{ ok: true; runtime: LocalRuntime } | { ok: false; why: string }> {
  const { runtime, why } = await probeServer(server.url, server.key)
  if (runtime) return { ok: true, runtime }
  return { ok: false, why: why ?? `Nothing answered at ${serverLabel(server.url)}.` }
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

// The one address there is anything to do about is Ollama's own on this
// machine. Somewhere else is somebody else's to start, and the command here
// would try to bind their host on this one; a port on this machine that nobody
// pointed Ollama at is a second Ollama nobody asked for, standing on a port
// that was silent for a reason.
function startable(url: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const at = parse(url)
  if (!at || !here(at.hostname)) return false
  const said = env.OLLAMA_HOST ? fullUrl(env.OLLAMA_HOST) : null
  return at.port === String(OLLAMA_PORT) || said === url
}

export async function ensureServing(url: string): Promise<boolean> {
  if (!startable(url)) return false
  const at = parse(url)
  if (await answering(url)) return true
  const command = resolveCommand('ollama')
  if (!command) return false
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
