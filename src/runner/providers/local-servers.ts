import fs from 'node:fs'
import path from 'node:path'
import { keyOf, withServer, withoutServer, type ModelServer } from '../../shared/modelServers'

const FILE_MODE = 0o600

let file: string | null = null
let cache: ModelServer[] | null = null

export function setServersPath(at: string): void {
  file = at
  cache = null
}

export function knownServers(): ModelServer[] {
  if (!cache) cache = read()
  return cache
}

export function rememberServer(server: ModelServer): ModelServer[] {
  const next = withServer(knownServers(), server)
  write(next)
  return next
}

export function forgetServer(url: string): ModelServer[] {
  const next = withoutServer(knownServers(), url)
  write(next)
  return next
}

export function serverKey(url: string): string | undefined {
  return keyOf(knownServers(), url)
}

function read(): ModelServer[] {
  if (!file) return []
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return []
    quarantine()
    return []
  }
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.filter(written)
  } catch {}
  quarantine()
  return []
}

function written(one: unknown): one is ModelServer {
  const said = one as ModelServer | null
  return typeof said?.url === 'string' && said.url.length > 0
}

function quarantine(): void {
  if (!file) return
  try {
    fs.renameSync(file, `${file}.corrupt-${Date.now()}`)
  } catch {}
}

function write(servers: ModelServer[]): void {
  cache = servers
  if (!file) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(servers, null, 2), { mode: FILE_MODE })
  fs.chmodSync(tmp, FILE_MODE)
  fs.renameSync(tmp, file)
}
