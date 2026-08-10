export interface ModelServer {
  url: string
  name?: string
  key?: string
}

export const SERVER_LIMIT = 20
export const SERVER_NAME_LIMIT = 40

export const OLLAMA_PORT = 11434

export const LOCAL_SERVERS: ReadonlyArray<{ port: number; name: string }> = [
  { port: OLLAMA_PORT, name: 'Ollama' },
  { port: 1234, name: 'LM Studio' },
  { port: 8080, name: 'llama-server' }
]

export const localUrl = (port: number): string => `http://127.0.0.1:${port}`

export const LOCAL_URLS: readonly string[] = LOCAL_SERVERS.map(one => localUrl(one.port))

export const localServerName = (port: string): string | undefined =>
  LOCAL_SERVERS.find(one => String(one.port) === port)?.name

const PREFIX = 'server:'

export const serverProviderName = (url: string): string => `${PREFIX}${url}`

export const serverUrlIn = (provider: string): string | null =>
  provider.startsWith(PREFIX) ? provider.slice(PREFIX.length) : null

export const cleanServerName = (said: string): string =>
  said.replace(/\s+/g, ' ').trim().slice(0, SERVER_NAME_LIMIT)

export function serverUrl(said: string): string | null {
  const written = said.trim().replace(/\/+$/, '')
  if (!written) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(written) ? written : `http://${written}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname) return null
  const path = url.pathname.replace(/\/+$/, '')
  return `${url.protocol}//${url.host}${path}`
}

export function openaiUrl(url: string, rest: string): string {
  return /\/v\d+$/.test(url) ? `${url}${rest}` : `${url}/v1${rest}`
}

export function serverLabel(url: string): string {
  const bare = url.replace(/^https?:\/\//i, '').replace(/\/v\d+$/, '')
  return bare || url
}

export const serverName = (server: ModelServer): string =>
  cleanServerName(server.name ?? '') || serverLabel(server.url)

export const sameServer = (a: string, b: string): boolean =>
  a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase()

export function withServer(servers: readonly ModelServer[], server: ModelServer): ModelServer[] {
  const rest = servers.filter(one => !sameServer(one.url, server.url))
  const held = servers.find(one => sameServer(one.url, server.url))
  const key = server.key ?? held?.key
  const name = cleanServerName(server.name ?? '') || held?.name
  return [
    { url: server.url, ...(name ? { name } : {}), ...(key ? { key } : {}) },
    ...rest
  ].slice(0, SERVER_LIMIT)
}

export const withoutServer = (servers: readonly ModelServer[], url: string): ModelServer[] =>
  servers.filter(one => !sameServer(one.url, url))

export const keyOf = (servers: readonly ModelServer[], url: string): string | undefined =>
  servers.find(one => sameServer(one.url, url))?.key
