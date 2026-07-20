import { runGit } from '../shared/git'

const DEFAULT_INTERVAL_MS = 15000

export class GitPuller {
  private chain: Promise<void> = Promise.resolve()
  private timer: NodeJS.Timeout | null = null
  private usable: boolean | null = null
  onLog: (line: string) => void = () => {}

  constructor(private repoPath: string) {}

  start(intervalMs = DEFAULT_INTERVAL_MS): void {
    this.stop()
    void this.pullNow()
    this.timer = setInterval(() => void this.pullNow(), intervalMs)
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  pullNow(): Promise<void> {
    this.chain = this.chain.then(() => this.pull()).catch(() => {})
    return this.chain
  }

  private async pull(): Promise<void> {
    if (this.usable === null) {
      const repo = await runGit(['rev-parse', '--git-dir'], this.repoPath)
      const remotes = repo.code === 0 ? await runGit(['remote'], this.repoPath) : null
      this.usable = !!remotes && remotes.stdout.trim().length > 0
    }
    if (!this.usable) return
    const pull = await runGit(['pull', '--rebase', '--autostash'], this.repoPath)
    if (pull.code !== 0) {
      await runGit(['rebase', '--abort'], this.repoPath)
      this.onLog(`auto-pull failed, left as is: ${pull.stderr.trim()}`)
    }
  }
}
