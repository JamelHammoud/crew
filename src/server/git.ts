import { runGit, type GitResult } from '../shared/git'
import type { RepoActionResult, RepoStatus } from '../shared/repository'

export class GitSync {
  private chain: Promise<void> = Promise.resolve()
  private timer: NodeJS.Timeout | null = null
  private hasRemote: boolean | null = null
  onLog: (line: string) => void = () => {}

  constructor(private repoPath: string) {}

  schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.syncNow(), 2000)
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
  }

  syncNow(message = 'crew sync'): Promise<void> {
    return this.enqueue(() => this.sync(message)).catch(() => {})
  }

  status(): Promise<RepoStatus> {
    return this.enqueue(() => this.readStatus())
  }

  pullNow(): Promise<RepoActionResult> {
    return this.enqueue(() => this.pullAction())
  }

  pushNow(message = 'crew sync'): Promise<RepoActionResult> {
    return this.enqueue(() => this.pushAction(message))
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const result = this.chain.then(action, action)
    this.chain = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private async sync(message: string): Promise<void> {
    const commit = await this.commitWorkingTree(message)
    if (!commit.ok) {
      this.onLog(`commit failed: ${commit.detail}`)
      return
    }
    await this.refreshRemote()
    if (!this.hasRemote) return
    const pull = await this.pullRemote(false)
    if (!pull.ok) {
      this.onLog(`pull failed, left as is: ${pull.detail}`)
      return
    }
    const push = await runGit(['push'], this.repoPath)
    if (push.code !== 0) {
      this.onLog(`push failed, will retry: ${push.stderr.trim()}`)
    }
  }

  // session.json is a state snapshot this machine rewrites on every poll, so a
  // conflicted hunk carries no information worth merging — keep the local copy.
  // While a rebase replays our commits onto origin, the local side is `--theirs`.
  private async pullAction(): Promise<RepoActionResult> {
    const before = await this.readStatus()
    if (!before.available) {
      return this.result(false, false, 'This project is not tracked with git.', before)
    }
    if (!before.remote) {
      return this.result(false, false, 'No remote is set up for this project.', before)
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
    message: string
  ): Promise<{ ok: boolean; updated: boolean; detail: string }> {
    const add = await runGit(['add', '-A'], this.repoPath)
    if (add.code !== 0) return { ok: false, updated: false, detail: gitDetail(add) }
    const staged = await runGit(['diff', '--cached', '--quiet'], this.repoPath)
    if (staged.code === 0) return { ok: true, updated: false, detail: '' }
    const commit = await runGit(['commit', '-m', message], this.repoPath)
    return {
      ok: commit.code === 0,
      updated: commit.code === 0,
      detail: commit.code === 0 ? '' : gitDetail(commit)
    }
  }

  private async pullRemote(autostash: boolean): Promise<{ ok: boolean; updated: boolean; detail: string }> {
    const before = await runGit(['rev-parse', 'HEAD'], this.repoPath)
    const args = ['pull', '--rebase']
    if (autostash) args.push('--autostash')
    const pull = await runGit(args, this.repoPath)
    if (pull.code !== 0) {
      const resolved = await this.resolveRebaseConflicts()
      if (!resolved) {
        await runGit(['rebase', '--abort'], this.repoPath)
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

  private async readStatus(): Promise<RepoStatus> {
    const repo = await runGit(['rev-parse', '--is-inside-work-tree'], this.repoPath)
    if (repo.code !== 0 || repo.stdout.trim() !== 'true') {
      return { available: false, remote: false, branch: '', changed: 0, ahead: 0, behind: 0 }
    }
    const [branch, changes, remotes, divergence] = await Promise.all([
      runGit(['branch', '--show-current'], this.repoPath),
      runGit(['status', '--porcelain'], this.repoPath),
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
        // rebase stopped without conflicts (e.g. a commit became empty), or the
        // pull failed for a non-rebase reason and there is nothing to continue
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
