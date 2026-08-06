export interface RepoStatus {
  available: boolean
  remote: boolean
  branch: string
  changed: number
  ahead: number
  behind: number
  // How many stashes are waiting. Nothing stashed here is ever left for
  // somebody to find later, so the Review tab can only say so if it is told.
  stashes: number
}

export type RepoChangeKind = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'conflict'

export interface RepoChange {
  path: string
  previousPath?: string
  kind: RepoChangeKind
  // Whether this is what the index holds or what the file on disk holds. A file
  // edited after it was staged is both, and comes back as two of these, which
  // is what lets the two lists say different things about the same path.
  staged: boolean
  added: number
  removed: number
  diff: string
  binary: boolean
  truncated: boolean
}

export interface RepoStash {
  ref: string
  message: string
  branch: string
}

export interface RepoBranch {
  name: string
  current: boolean
  // A branch that is only on the remote so far. Switching to one is git making
  // the local branch that follows it, so it is offered beside the local ones.
  remote: boolean
}

export interface RepoWork {
  status: RepoStatus
  changes: RepoChange[]
  stashes: RepoStash[]
  branches: RepoBranch[]
}

// Every git action is one of these rather than one channel each, so a new verb
// is a case here and nothing else has to be wired up again.
export type RepoCommand =
  | { do: 'stage'; paths: string[] }
  | { do: 'unstage'; paths: string[] }
  | { do: 'discard'; paths: string[] }
  | { do: 'commit'; message: string; amend?: boolean }
  | { do: 'stash'; message?: string; keepIndex?: boolean }
  | { do: 'apply'; ref: string }
  | { do: 'drop'; ref: string }
  | { do: 'pull' }
  | { do: 'push' }

export interface RepoActionResult {
  ok: boolean
  updated: boolean
  message: string
  status: RepoStatus
}
