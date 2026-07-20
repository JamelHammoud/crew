import { runGit } from '../shared/git'

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
    this.chain = this.chain.then(() => this.sync(message)).catch(() => {})
    return this.chain
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
      await runGit(['rebase', '--abort'], this.repoPath)
      this.onLog(`pull failed, left as is: ${pull.stderr.trim()}`)
    }
    const push = await runGit(['push'], this.repoPath)
    if (push.code !== 0) {
      this.onLog(`push failed, will retry: ${push.stderr.trim()}`)
    }
  }
}
