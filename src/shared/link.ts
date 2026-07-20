export interface JoinTarget {
  host: string
  port: number
  code: string
}

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

export function wsUrl(target: JoinTarget): string {
  return `ws://${target.host}:${target.port}/ws`
}
