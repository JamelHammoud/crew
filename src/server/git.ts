import { execFile } from 'node:child_process'

interface GitResult {
  code: number
  stdout: string
  stderr: string
}

function git(args: string[], cwd: string): Promise<GitResult> {
  return new Promise(resolve => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      resolve({ code: error ? (error as { code?: number }).code ?? 1 : 0, stdout, stderr })
    })
  })
}

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
    await git(['add', '-A'], this.repoPath)
    const staged = await git(['diff', '--cached', '--quiet'], this.repoPath)
    if (staged.code !== 0) {
      const commit = await git(['commit', '-m', message], this.repoPath)
      if (commit.code !== 0) {
        this.onLog(`commit failed: ${commit.stderr.trim()}`)
        return
      }
    }
    if (this.hasRemote === null) {
      const remotes = await git(['remote'], this.repoPath)
      this.hasRemote = remotes.stdout.trim().length > 0
    }
    if (!this.hasRemote) return
    const pull = await git(['pull', '--rebase'], this.repoPath)
    if (pull.code !== 0) {
      await git(['rebase', '--abort'], this.repoPath)
      this.onLog(`pull failed, left as is: ${pull.stderr.trim()}`)
    }
    const push = await git(['push'], this.repoPath)
    if (push.code !== 0) {
      this.onLog(`push failed, will retry: ${push.stderr.trim()}`)
    }
  }
}
