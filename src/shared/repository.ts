export interface RepoStatus {
  available: boolean
  remote: boolean
  branch: string
  changed: number
  ahead: number
  behind: number
}

export type RepoChangeKind = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'conflict'

export interface RepoChange {
  path: string
  previousPath?: string
  kind: RepoChangeKind
  added: number
  removed: number
  diff: string
  binary: boolean
  truncated: boolean
}

export interface RepoActionResult {
  ok: boolean
  updated: boolean
  message: string
  status: RepoStatus
}
