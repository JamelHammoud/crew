export interface JoinTarget {
  host: string
  port: number
  code: string
}

// The port is the machine's now rather than the crew's, so the code is the whole
// of what says which crew a guest is reaching and the only thing standing between
// somebody on the network and one they were never sent.
export const CODE_BYTES = 8

export function makeLink(host: string, port: number, code: string): string {
  return `crew://${host}:${port}/${code}`
}

export function parseLink(raw: string): JoinTarget {
  const match = /^(?:crew:\/\/)?([a-zA-Z0-9.-]+):(\d+)\/([a-z0-9]+)$/i.exec(raw.trim())
  if (!match) {
    throw new Error('That link does not look right. It should look like crew://host:port/code')
  }
  return { host: match[1], port: Number(match[2]), code: match[3].toLowerCase() }
}

// Every address into a crew names it, the socket and the http both, so the http
// base a runner and a window read off this carries the code with nothing else
// having to be handed around for it.
export function wsUrl(target: JoinTarget): string {
  return `ws://${target.host}:${target.port}/${target.code}/ws`
}
