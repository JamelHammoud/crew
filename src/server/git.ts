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
    await runGit(['add', '-A'], this.repoPath)
    const staged = await runGit(['diff', '--cached', '--quiet'], this.repoPath)
    if (staged.code !== 0) {
      const commit = await runGit(['commit', '-m', message], this.repoPath)
      if (commit.code !== 0) {
        this.onLog(`commit failed: ${commit.stderr.trim()}`)
        return
      }
    }
    if (this.hasRemote === null) {
      const remotes = await runGit(['remote'], this.repoPath)
      this.hasRemote = remotes.stdout.trim().length > 0
    }
    if (!this.hasRemote) return
    const pull = await runGit(['pull', '--rebase'], this.repoPath)
    if (pull.code !== 0) {
      const resolved = await this.resolveRebaseConflicts()
      if (!resolved) {
        await runGit(['rebase', '--abort'], this.repoPath)
        this.onLog(`pull failed, left as is: ${pull.stderr.trim()}`)
      }
    }
    const push = await runGit(['push'], this.repoPath)
    if (push.code !== 0) {
      this.onLog(`push failed, will retry: ${push.stderr.trim()}`)
    }
  }

  // session.json is a state snapshot this machine rewrites on every poll, so a
  // conflicted hunk carries no information worth merging — keep the local copy.
  // While a rebase replays our commits onto origin, the local side is `--theirs`.
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
