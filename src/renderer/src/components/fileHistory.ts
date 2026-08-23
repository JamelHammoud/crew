export type FileEditKind = 'type' | 'delete-backward' | 'delete-forward' | 'composition' | 'command'

export interface FileSelection {
  start: number
  end: number
  direction: 'forward' | 'backward' | 'none'
}

export interface FileSnapshot {
  text: string
  selection: FileSelection
}

interface FileHistoryEntry {
  from: number
  removed: string
  inserted: string
  before: FileSelection
  after: FileSelection
  kind: FileEditKind
  time: number
}

export interface FileHistory {
  past: FileHistoryEntry[]
  future: FileHistoryEntry[]
}

const GROUP_MS = 1000
const LIMIT = 500

const sameSelection = (one: FileSelection, two: FileSelection): boolean =>
  one.start === two.start && one.end === two.end && one.direction === two.direction

const collapsed = (selection: FileSelection): boolean => selection.start === selection.end

const change = (
  before: string,
  after: string,
  startHint: number
): Pick<FileHistoryEntry, 'from' | 'removed' | 'inserted'> => {
  const max = Math.min(before.length, after.length)
  const limit = Math.max(0, Math.min(startHint, max))
  let head = 0
  while (head < limit && before[head] === after[head]) head += 1
  let tail = 0
  while (tail < max - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail += 1
  return {
    from: head,
    removed: before.slice(head, before.length - tail),
    inserted: after.slice(head, after.length - tail)
  }
}

const merge = (previous: FileHistoryEntry, next: FileHistoryEntry): boolean => {
  if (previous.kind !== next.kind || next.time - previous.time > GROUP_MS) return false
  if (!sameSelection(previous.after, next.before)) return false
  if (!collapsed(previous.before) || !collapsed(previous.after) || !collapsed(next.after)) return false
  if (next.kind === 'type') {
    if (previous.removed || next.removed || !previous.inserted || !next.inserted) return false
    if (next.from !== previous.from + previous.inserted.length) return false
    previous.inserted += next.inserted
  } else if (next.kind === 'delete-backward') {
    if (previous.inserted || next.inserted || !previous.removed || !next.removed) return false
    if (next.from + next.removed.length !== previous.from) return false
    previous.from = next.from
    previous.removed = next.removed + previous.removed
  } else if (next.kind === 'delete-forward') {
    if (previous.inserted || next.inserted || !previous.removed || !next.removed) return false
    if (next.from !== previous.from) return false
    previous.removed += next.removed
  } else if (next.kind === 'composition') {
    if (next.from !== previous.from || next.removed !== previous.inserted) return false
    previous.inserted = next.inserted
  } else {
    return false
  }
  previous.after = next.after
  previous.time = next.time
  return true
}

export const createFileHistory = (): FileHistory => ({ past: [], future: [] })

export function clearFileHistory(history: FileHistory): void {
  history.past = []
  history.future = []
}

export function recordFileEdit(
  history: FileHistory,
  before: FileSnapshot,
  after: FileSnapshot,
  kind: FileEditKind,
  time = Date.now()
): void {
  if (before.text === after.text) return
  const entry: FileHistoryEntry = {
    ...change(before.text, after.text, Math.min(before.selection.start, after.selection.start)),
    before: before.selection,
    after: after.selection,
    kind,
    time
  }
  const previous = history.past[history.past.length - 1]
  if (!previous || !merge(previous, entry)) history.past.push(entry)
  if (history.past.length > LIMIT) history.past.splice(0, history.past.length - LIMIT)
  history.future = []
}

export function undoFileEdit(history: FileHistory, text: string): FileSnapshot | null {
  const entry = history.past.pop()
  if (!entry) return null
  history.future.push(entry)
  return {
    text: text.slice(0, entry.from) + entry.removed + text.slice(entry.from + entry.inserted.length),
    selection: entry.before
  }
}

export function redoFileEdit(history: FileHistory, text: string): FileSnapshot | null {
  const entry = history.future.pop()
  if (!entry) return null
  history.past.push(entry)
  return {
    text: text.slice(0, entry.from) + entry.inserted + text.slice(entry.from + entry.removed.length),
    selection: entry.after
  }
}
