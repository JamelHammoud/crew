import type { CrewHome } from './project'

export interface OpenRequest {
  folder: string
  file?: string
  name?: string
  home?: CrewHome
  share?: boolean
  link?: string
}

export const OPEN_FLAG = '--crew-open='

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function cleanOpenRequest(input: unknown): OpenRequest | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  const folder = text(raw.folder)
  if (!folder) return null
  const request: OpenRequest = { folder }
  const file = text(raw.file)
  if (file && !file.startsWith('/') && !file.split(/[\\/]/).includes('..')) request.file = file
  const name = text(raw.name)
  if (name) request.name = name
  if (raw.home === 'folder' || raw.home === 'private') request.home = raw.home
  if (typeof raw.share === 'boolean') request.share = raw.share
  const link = text(raw.link)
  if (link) request.link = link
  return request
}

export function openFlag(request: OpenRequest): string {
  return `${OPEN_FLAG}${JSON.stringify(request)}`
}

export function openRequestOf(argv: readonly string[]): OpenRequest | null {
  const found = argv.find(arg => arg.startsWith(OPEN_FLAG))
  if (!found) return null
  try {
    return cleanOpenRequest(JSON.parse(found.slice(OPEN_FLAG.length)))
  } catch {
    return null
  }
}
