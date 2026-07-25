import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import {
  overwrittenPaths,
  restoreAutostash,
  runGit,
  stashCount,
  takeSyncLock,
  type GitResult
} from '../shared/git'
import { interruptedStates } from '../shared/gitState'
import type { RepoActionResult, RepoChange, RepoChangeKind, RepoStatus } from '../shared/repository'

const PROJECT_PATHS = ['.', ':(exclude).crew', ':(exclude).crew/**']
const DIFF_LIMIT = 200_000
const DIFF_LINE_LIMIT = 2_000
const AUTO_SYNC_MS = 5000
const DEBOUNCE_MS = 2000

interface StatusEntry {
  code: string
  path: string
  previousPath?: string
}

export class GitSync {
  private chain: Promise<void> = Promise.resolve()
  private timer: NodeJS.Timeout | null = null
  private loop: NodeJS.Timeout | null = null
  private hasRemote: boolean | null = null
  private inRepo: boolean | null = null
  onLog: (line: string) => void = () => {}

  constructor(private repoPath: string) {}

  start(intervalMs = AUTO_SYNC_MS): void {
    this.stop()
    void this.syncNow()
    this.loop = setInterval(() => void this.syncNow(), intervalMs)
    this.loop.unref?.()
  }

  schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.syncNow(), DEBOUNCE_MS)
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    if (this.loop) clearInterval(this.loop)
    this.timer = null
    this.loop = null
  }

  syncNow(message = 'crew sync'): Promise<void> {
    return this.enqueue(() => this.sync(message)).catch(() => {})
  }

  status(): Promise<RepoStatus> {
    return this.enqueue(() => this.readStatus())
  }

  changes(): Promise<RepoChange[]> {
    return this.enqueue(() => this.readChanges())
  }

  pullNow(): Promise<RepoActionResult> {
    return this.enqueue(() => this.exclusive(() => this.pullAction()))
  }

  pushNow(message = 'crew sync'): Promise<RepoActionResult> {
    return this.enqueue(() => this.exclusive(() => this.pushAction(message)))
  }

  private async exclusive(action: () => Promise<RepoActionResult>): Promise<RepoActionResult> {
    const release = await takeSyncLock(this.repoPath)
    if (!release) {
      return this.result(false, false, 'This project is syncing right now. Try again in a moment.', await this.readStatus())
    }
    try {
      return await action()
    } finally {
      await release()
    }
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const result = this.chain.then(action, action)
    this.chain = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  // The whole working tree goes out on every pass. A session is only useful
  // when the code everyone is looking at is the same code.
  private async sync(message: string): Promise<void> {
    if (!(await this.usable())) return
    const release = await takeSyncLock(this.repoPath)
    if (!release) return
    try {
      await this.syncLocked(message)
    } finally {
      await release()
    }
  }

  private async syncLocked(message: string): Promise<void> {
    if (!(await this.settle())) {
      this.onLog('this folder is stuck part way through a git operation, will retry')
      return
    }
    const commit = await this.commitWorkingTree(message)
    if (!commit.ok) {
      this.onLog(`commit failed: ${commit.detail}`)
      return
    }
    await this.refreshRemote()
    if (!this.hasRemote) return
    // Everything is committed by the time we get here, so there is nothing to
    // autostash. Stashing here is what used to strand people's work.
    const pull = await this.pullRemote(false)
    if (!pull.ok) {
      this.onLog(`pull failed, will retry: ${pull.detail}`)
      return
    }
    const push = await runGit(['push'], this.repoPath)
    if (push.code !== 0) {
      this.onLog(`push failed, will retry: ${push.stderr.trim()}`)
    }
  }

  private async usable(): Promise<boolean> {
    if (this.inRepo === null) {
      const repo = await runGit(['rev-parse', '--is-inside-work-tree'], this.repoPath)
      this.inRepo = repo.code === 0 && repo.stdout.trim() === 'true'
    }
    return this.inRepo
  }

  private async pullAction(): Promise<RepoActionResult> {
    const before = await this.readStatus()
    if (!before.available) {
      return this.result(false, false, 'This project is not tracked with git.', before)
    }
    if (!before.remote) {
      return this.result(false, false, 'No remote is set up for this project.', before)
    }
    const blocked = await this.blockedPaths()
    if (blocked.length > 0) {
      return this.result(
        false,
        false,
        `Push your changes to ${describePaths(blocked)} first, a pull would replace them.`,
        before
      )
    }
    const pull = await this.pullRemote(true)
    const status = await this.readStatus()
    if (!pull.ok) return this.result(false, false, `Could not pull. ${pull.detail}`, status)
    return this.result(
      true,
      pull.updated,
      pull.updated ? 'Pulled the latest changes.' : 'Already up to date.',
      status
    )
  }

  private async pushAction(message: string): Promise<RepoActionResult> {
    const before = await this.readStatus()
    if (!before.available) {
      return this.result(false, false, 'This project is not tracked with git.', before)
    }
    if (!before.remote) {
      return this.result(false, false, 'No remote is set up for this project.', before)
    }
    const commit = await this.commitWorkingTree(message)
    if (!commit.ok) {
      const status = await this.readStatus()
      return this.result(false, false, `Could not save changes. ${commit.detail}`, status)
    }
    const pull = await this.pullRemote(false)
    if (!pull.ok) {
      const status = await this.readStatus()
      return this.result(false, false, `Could not pull before pushing. ${pull.detail}`, status)
    }
    const hadChanges = commit.updated || pull.updated || before.ahead > 0
    const push = await runGit(['push'], this.repoPath)
    const status = await this.readStatus()
    if (push.code !== 0) {
      return this.result(false, false, `Could not push. ${gitDetail(push)}`, status)
    }
    return this.result(
      true,
      hadChanges,
      hadChanges ? 'Pushed the latest changes.' : 'Already up to date.',
      status
    )
  }

  private async commitWorkingTree(
    message: string,
    paths?: string[]
  ): Promise<{ ok: boolean; updated: boolean; detail: string }> {
    const scope = paths ? ['--', ...paths] : []
    const add = await runGit(['add', '-A', ...scope], this.repoPath)
    if (add.code !== 0) return { ok: false, updated: false, detail: gitDetail(add) }
    const staged = await runGit(['diff', '--cached', '--quiet', ...scope], this.repoPath)
    if (staged.code === 0) return { ok: true, updated: false, detail: '' }
    const commit = await runGit(['commit', '-m', message, ...scope], this.repoPath)
    return {
      ok: commit.code === 0,
      updated: commit.code === 0,
      detail: commit.code === 0 ? '' : gitDetail(commit)
    }
  }

  // Merging, not rebasing. A rebase replays every local commit, rewriting the
  // working tree once per commit, and each rewrite can land on top of a file an
  // agent is writing right now. A merge leaves local commits alone and touches
  // only what actually came in.
  private async pullRemote(autostash: boolean): Promise<{ ok: boolean; updated: boolean; detail: string }> {
    const before = await runGit(['rev-parse', 'HEAD'], this.repoPath)
    const stashes = await stashCount(this.repoPath)
    const args = ['pull', '--no-rebase', '--no-edit']
    if (autostash) args.push('--autostash')
    const pull = await runGit(args, this.repoPath)
    if (pull.code !== 0) {
      if (!(await this.mergeActive())) {
        await restoreAutostash(this.repoPath, stashes)
        return { ok: false, updated: false, detail: gitDetail(pull) }
      }
      if (!(await this.resolveMergeConflicts())) {
        await this.abortKeepingWork(['merge', '--abort'])
        await restoreAutostash(this.repoPath, stashes)
        return { ok: false, updated: false, detail: gitDetail(pull) }
      }
    }
    const after = await runGit(['rev-parse', 'HEAD'], this.repoPath)
    return {
      ok: true,
      updated: before.code === 0 && after.code === 0 && before.stdout.trim() !== after.stdout.trim(),
      detail: ''
    }
  }

  private async mergeActive(): Promise<boolean> {
    return (await interruptedStates(this.repoPath)).some(state => state.label === 'merge')
  }

  // session.json is a snapshot this machine rewrites on every poll, so a
  // conflicted hunk carries nothing worth merging. Everything else is real work
  // and a person has to look at it.
  private async resolveMergeConflicts(): Promise<boolean> {
    const conflicts = await runGit(['diff', '--name-only', '--diff-filter=U'], this.repoPath)
    const files = conflicts.stdout.trim().split('\n').filter(Boolean)
    if (files.length === 0 || files.some(file => !file.endsWith('session.json'))) return false
    const take = await runGit(['checkout', '--ours', '--', ...files], this.repoPath)
    if (take.code !== 0) return false
    await runGit(['add', '--', ...files], this.repoPath)
    const commit = await runGit(['-c', 'core.editor=true', 'commit', '--no-edit'], this.repoPath)
    return commit.code === 0
  }

  private async blockedPaths(): Promise<string[]> {
    const fetch = await runGit(['fetch', '--quiet'], this.repoPath)
    if (fetch.code !== 0) return []
    return overwrittenPaths(this.repoPath)
  }

  // A machine that was closed mid-rebase comes back to a repo git will not let
  // anyone commit to. Finish the rebase if it can be finished, otherwise back
  // out of it, and either way keep whatever was written in the meantime.
  private async settle(): Promise<boolean> {
    const states = await interruptedStates(this.repoPath)
    if (states.length === 0) return true
    const labels = states.map(state => state.label)
    // A rebase only ever gets here from outside crew now, but a machine that was
    // closed part way through one still has to be dug out.
    if (labels.includes('rebase') && (await this.resolveRebaseConflicts())) {
      this.onLog('picked up an interrupted rebase and finished it')
      return true
    }
    if (labels.includes('merge') && (await this.resolveMergeConflicts())) {
      this.onLog('picked up an interrupted merge and finished it')
      return true
    }
    for (const state of states) await this.abortKeepingWork(state.abort)
    const left = await interruptedStates(this.repoPath)
    if (left.length > 0) return false
    this.onLog(`backed out of an interrupted ${states.map(state => state.label).join(' and ')}`)
    return true
  }

  // Aborting resets the working tree, which is how a half-written chat log or a
  // file an agent just wrote used to disappear. Put those files back afterwards.
  private async abortKeepingWork(abort: string[]): Promise<void> {
    const kept = await this.readPending()
    await runGit(abort, this.repoPath)
    for (const [file, contents] of kept) {
      const target = path.resolve(this.repoPath, file)
      try {
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, file.endsWith('.jsonl') ? await mergedLines(target, contents) : contents)
      } catch {
        // a path that cannot be written back is one git already owns
      }
    }
  }

  private async readPending(): Promise<Map<string, Buffer>> {
    const status = await runGit(
      ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
      this.repoPath
    )
    if (status.code !== 0) return new Map()
    const kept = new Map<string, Buffer>()
    for (const entry of parseStatus(status.stdout)) {
      // a conflicted file holds markers, not work worth restoring
      if (entry.code.includes('U') || entry.code === 'AA' || entry.code === 'DD') continue
      try {
        kept.set(entry.path, await fs.readFile(path.resolve(this.repoPath, entry.path)))
      } catch {
        // deleted or unreadable, nothing to keep
      }
    }
    return kept
  }

  private async readStatus(): Promise<RepoStatus> {
    const repo = await runGit(['rev-parse', '--is-inside-work-tree'], this.repoPath)
    if (repo.code !== 0 || repo.stdout.trim() !== 'true') {
      return { available: false, remote: false, branch: '', changed: 0, ahead: 0, behind: 0 }
    }
    const [branch, changes, remotes, divergence] = await Promise.all([
      runGit(['branch', '--show-current'], this.repoPath),
      runGit(['status', '--porcelain', '--', ...PROJECT_PATHS], this.repoPath),
      runGit(['remote'], this.repoPath),
      runGit(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], this.repoPath)
    ])
    const [ahead = 0, behind = 0] =
      divergence.code === 0
        ? divergence.stdout
            .trim()
            .split(/\s+/)
            .map(value => Number.parseInt(value, 10) || 0)
        : []
    const changed = changes.stdout.trim() ? changes.stdout.trim().split(/\r?\n/).length : 0
    const remote = remotes.code === 0 && remotes.stdout.trim().length > 0
    this.hasRemote = remote
    return {
      available: true,
      remote,
      branch: branch.stdout.trim(),
      changed,
      ahead,
      behind
    }
  }

  private async readChanges(): Promise<RepoChange[]> {
    const status = await runGit(
      ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...PROJECT_PATHS],
      this.repoPath
    )
    if (status.code !== 0) return []
    const changes = await Promise.all(parseStatus(status.stdout).map(entry => this.readChange(entry)))
    return changes.sort((a, b) => a.path.localeCompare(b.path))
  }

  private async readChange(entry: StatusEntry): Promise<RepoChange> {
    const kind = changeKind(entry.code)
    if (entry.code === '??') return this.readNewFile(entry, kind)
    const result = await runGit(
      ['diff', '--no-ext-diff', '--no-color', '--unified=3', 'HEAD', '--', entry.path],
      this.repoPath
    )
    if (result.code !== 0 && kind === 'added') return this.readNewFile(entry, kind)
    const diff = result.stdout
    const counts = diffCounts(diff)
    const binary = /^Binary files |^GIT binary patch/m.test(diff)
    const preview = diffPreview(diff)
    return {
      path: entry.path,
      previousPath: entry.previousPath,
      kind,
      added: counts.added,
      removed: counts.removed,
      diff: preview.diff,
      binary,
      truncated: preview.truncated
    }
  }

  private async readNewFile(entry: StatusEntry, kind: RepoChangeKind): Promise<RepoChange> {
    const empty = {
      path: entry.path,
      previousPath: entry.previousPath,
      kind,
      added: 0,
      removed: 0,
      diff: '',
      binary: false,
      truncated: false
    }
    try {
      const target = path.resolve(this.repoPath, entry.path)
      const stat = await fs.lstat(target)
      if (!stat.isFile()) return { ...empty, binary: stat.isSymbolicLink() }
      const handle = await fs.open(target, 'r')
      const length = Math.min(stat.size, DIFF_LIMIT + 1)
      const buffer = Buffer.alloc(length)
      let bytesRead = 0
      try {
        bytesRead = (await handle.read(buffer, 0, length, 0)).bytesRead
      } finally {
        await handle.close()
      }
      const contents = buffer.subarray(0, Math.min(bytesRead, DIFF_LIMIT))
      if (contents.includes(0)) {
        return { ...empty, binary: true, truncated: stat.size > DIFF_LIMIT }
      }
      const text = contents.toString('utf8').replace(/\r\n/g, '\n')
      const lines = text ? text.split('\n') : []
      if (lines.at(-1) === '') lines.pop()
      const previewLines = lines.slice(0, DIFF_LINE_LIMIT)
      const diff =
        previewLines.length === 0
          ? ''
          : [
              `diff --git a/${entry.path} b/${entry.path}`,
              'new file mode 100644',
              '--- /dev/null',
              `+++ b/${entry.path}`,
              `@@ -0,0 +1,${lines.length} @@`,
              ...previewLines.map(line => `+${line}`)
            ].join('\n')
      return {
        ...empty,
        added: lines.length,
        diff: diff.slice(0, DIFF_LIMIT),
        truncated: stat.size > DIFF_LIMIT || lines.length > DIFF_LINE_LIMIT || diff.length > DIFF_LIMIT
      }
    } catch {
      return empty
    }
  }

  private async refreshRemote(): Promise<void> {
    if (this.hasRemote !== null) return
    const remotes = await runGit(['remote'], this.repoPath)
    this.hasRemote = remotes.code === 0 && remotes.stdout.trim().length > 0
  }

  private result(
    ok: boolean,
    updated: boolean,
    message: string,
    status: RepoStatus
  ): RepoActionResult {
    return { ok, updated, message, status }
  }

  private async resolveRebaseConflicts(): Promise<boolean> {
    for (let i = 0; i < 50; i++) {
      const conflicts = await runGit(['diff', '--name-only', '--diff-filter=U'], this.repoPath)
      const files = conflicts.stdout.trim().split('\n').filter(Boolean)
      if (files.length === 0) {
        // A rebase stopped with nothing conflicting still has commits left to
        // replay. Carry on with them; skipping here would throw one away.
        const cont = await runGit(['-c', 'core.editor=true', 'rebase', '--continue'], this.repoPath)
        if (cont.code === 0) return true
        const output = `${cont.stderr}${cont.stdout}`
        if (!/no changes|did you forget|nothing to commit/i.test(output)) return false
        // the commit became empty once replayed, so there is nothing to keep
        const skip = await runGit(['rebase', '--skip'], this.repoPath)
        if (skip.code === 0) return true
        const recheck = await runGit(['diff', '--name-only', '--diff-filter=U'], this.repoPath)
        if (!recheck.stdout.trim()) return false
        continue
      }
      if (files.some(f => !f.endsWith('session.json'))) return false
      const take = await runGit(['checkout', '--theirs', '--', ...files], this.repoPath)
      if (take.code !== 0) return false
      await runGit(['add', '--', ...files], this.repoPath)
      const cont = await runGit(['-c', 'core.editor=true', 'rebase', '--continue'], this.repoPath)
      if (cont.code === 0) return true
    }
    return false
  }
}

function parseStatus(output: string): StatusEntry[] {
  const fields = output.split('\0')
  const entries: StatusEntry[] = []
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index]
    if (!field) continue
    const code = field.slice(0, 2)
    const entry: StatusEntry = { code, path: field.slice(3) }
    if (/[RC]/.test(code)) entry.previousPath = fields[++index] || undefined
    entries.push(entry)
  }
  return entries
}

function changeKind(code: string): RepoChangeKind {
  if (code === '??') return 'added'
  if (code.includes('U') || code === 'AA' || code === 'DD') return 'conflict'
  if (code.includes('R')) return 'renamed'
  if (code.includes('C')) return 'copied'
  if (code.includes('D')) return 'deleted'
  if (code.includes('A')) return 'added'
  return 'modified'
}

function diffCounts(diff: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  let hunk = false
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      hunk = false
    } else if (line.startsWith('@@')) {
      hunk = true
    } else if (hunk && line.startsWith('+')) {
      added++
    } else if (hunk && line.startsWith('-')) {
      removed++
    }
  }
  return { added, removed }
}

function diffPreview(diff: string): { diff: string; truncated: boolean } {
  const lines = diff.split(/\r?\n/)
  const preview = lines.slice(0, DIFF_LINE_LIMIT).join('\n')
  return {
    diff: preview.slice(0, DIFF_LIMIT),
    truncated: lines.length > DIFF_LINE_LIMIT || preview.length > DIFF_LIMIT
  }
}

// An event log only ever grows, so putting one back means keeping every line
// either side has rather than picking a winner.
async function mergedLines(target: string, kept: Buffer): Promise<string> {
  const current = await fs.readFile(target, 'utf8').catch(() => '')
  const lines = current.split('\n').filter(Boolean)
  const seen = new Set(lines)
  for (const line of kept.toString('utf8').split('\n')) {
    if (!line || seen.has(line)) continue
    seen.add(line)
    lines.push(line)
  }
  return `${lines.join('\n')}\n`
}

function describePaths(paths: string[]): string {
  if (paths.length === 1) return paths[0]
  if (paths.length === 2) return `${paths[0]} and ${paths[1]}`
  return `${paths[0]} and ${paths.length - 1} other files`
}

function gitDetail(result: GitResult): string {
  const text = result.stderr.trim() || result.stdout.trim() || 'Git did not finish.'
  return text.replace(/^fatal:\s*/i, '').split(/\r?\n/)[0]
}
