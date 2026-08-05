// A server that answers a model, written down by whoever reaches it. The
// address is the agent's and rides in its settings; the key is the machine's
// and never goes anywhere near them, the way a plugin's key is read off the
// machine running the agent rather than out of the record the crew shares.
export interface ModelServer {
  url: string
  key?: string
}

export const SERVER_LIMIT = 20

// What a written address is allowed to be. A scheme is added where there is
// none, since nobody types one, and the path is kept exactly as it was given:
// "llm.example.com:39862/v1" is a base that already names where the models
// are, and dropping that is asking the wrong machine for them.
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

// Where the OpenAI compatible routes stand under a base. A base that already
// names the version takes the rest as it is, and a bare host is given the one
// every server of this kind serves on.
export function openaiUrl(url: string, rest: string): string {
  return /\/v\d+$/.test(url) ? `${url}${rest}` : `${url}/v1${rest}`
}

// What the address is called where there is no room for the whole of it. The
// scheme is noise, and so is the version at the end, which every one of these
// carries: what tells two servers apart is the host.
export function serverLabel(url: string): string {
  const bare = url.replace(/^https?:\/\//i, '').replace(/\/v\d+$/, '')
  return bare || url
}

export const sameServer = (a: string, b: string): boolean =>
  a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase()

export function withServer(servers: readonly ModelServer[], server: ModelServer): ModelServer[] {
  const rest = servers.filter(one => !sameServer(one.url, server.url))
  // A key already held is kept where the same server is written down again
  // without one, or somebody adding a model to a server they set up months ago
  // signs themselves out of it.
  const held = servers.find(one => sameServer(one.url, server.url))
  const key = server.key ?? held?.key
  return [{ url: server.url, ...(key ? { key } : {}) }, ...rest].slice(0, SERVER_LIMIT)
}

export const withoutServer = (servers: readonly ModelServer[], url: string): ModelServer[] =>
  servers.filter(one => !sameServer(one.url, url))

export const keyOf = (servers: readonly ModelServer[], url: string): string | undefined =>
  servers.find(one => sameServer(one.url, url))?.key
