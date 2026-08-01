import type { RepoChange } from '../../../../shared/repository'
import { rowKey } from '../../state/reviewed'

export const keyOf = (change: RepoChange): string => rowKey(change.path, change.staged)

const pathOf = (key: string): string => key.slice(key.indexOf(':') + 1)

export interface Groups {
  clashing: RepoChange[]
  staged: RepoChange[]
  loose: RepoChange[]
}

// The three groups, in the order they are drawn. A conflict is neither staged
// nor unstaged until somebody has settled it, so it is taken out of both rather
// than standing in Merge Changes and in Staged Changes at once.
export function groupsOf(changes: RepoChange[]): Groups {
  return {
    clashing: changes.filter(change => change.kind === 'conflict'),
    staged: changes.filter(change => change.staged && change.kind !== 'conflict'),
    loose: changes.filter(change => !change.staged && change.kind !== 'conflict')
  }
}

// The whole panel folded into one line to walk down, in the order it is really
// drawn. Reading is walking this rather than coming back to the list between
// files, so every step is an index into it and nothing has to be searched for.
export function reviewWalk(changes: RepoChange[]): RepoChange[] {
  const { clashing, staged, loose } = groupsOf(changes)
  return [...clashing, ...staged, ...loose]
}

export function stepTo(walk: RepoChange[], key: string, by: 1 | -1): RepoChange | null {
  const at = walk.findIndex(change => keyOf(change) === key)
  if (at < 0) return null
  return walk[at + by] ?? null
}

// What the reading pane is standing on. Staging a file from inside it moves
// that file to another group, and the key carries which group it was in, so the
// key it was opened under is gone the moment it is staged. It is the same file
// and the same reading, so the screen follows the path when the key it had has
// stopped answering, and only falls back to nothing once the file itself has
// gone from the working tree.
export function readingAt(walk: RepoChange[], key: string | null): RepoChange | null {
  if (!key) return null
  const exact = walk.find(change => keyOf(change) === key)
  if (exact) return exact
  const path = pathOf(key)
  return walk.find(change => change.path === path) ?? null
}
