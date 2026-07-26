export interface FileEntry {
  name: string
  dir: boolean
}

export type RepoPathKind = 'file' | 'dir' | 'missing'

// Where a path an agent mentioned lives, from this machine's point of view.
// 'repo' paths are shown relative to the project, 'local' paths are elsewhere
// on this computer and are shown as written, and 'private' paths are on
// someone else's computer, where nobody here can follow them.
export type PathLocation =
  | { kind: 'repo'; path: string; exists: boolean }
  | { kind: 'local'; exists: boolean }
  | { kind: 'private' }

const slashed = (text: string): string => text.split('\\').join('/')

const rootPattern = (root: string): string =>
  slashed(root)
    .replace(/\/+$/, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .split('/')
    .join('[\\\\/]')

export function stripRoot(root: string, target: string): string {
  const base = slashed(root).replace(/\/+$/, '')
  const value = slashed(target)
  return value.startsWith(`${base}/`) ? value.slice(base.length + 1) : target
}

export function stripRootFromText(root: string, text: string): string {
  const pattern = new RegExp(`${rootPattern(root)}[\\\\/]([^\\s'"]*)`, 'g')
  return text.replace(pattern, (_, tail: string) => slashed(tail))
}

export type RepoFile =
  | { kind: 'file'; path: string; text: string; truncated: boolean }
  | { kind: 'dir'; path: string; entries: FileEntry[] }
  | { kind: 'image'; path: string; url: string; size: number }
  | { kind: 'binary'; path: string; size: number }
  | { kind: 'missing'; path: string }
