export interface FileEntry {
  name: string
  dir: boolean
}

export type RepoFile =
  | { kind: 'file'; path: string; text: string; truncated: boolean }
  | { kind: 'dir'; path: string; entries: FileEntry[] }
  | { kind: 'binary'; path: string; size: number }
  | { kind: 'missing'; path: string }
