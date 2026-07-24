export interface RepoStatus {
  available: boolean
  remote: boolean
  branch: string
  changed: number
  ahead: number
  behind: number
}

export interface RepoActionResult {
  ok: boolean
  updated: boolean
  message: string
  status: RepoStatus
}
