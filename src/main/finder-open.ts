import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type { OpenRequest } from '../shared/cli'
import { runGit } from '../shared/git'

export async function finderOpenRequest(target: string): Promise<OpenRequest | null> {
  const absolute = path.resolve(target)
  const found = await stat(absolute).catch(() => null)
  if (!found) return null
  const canonical = await realpath(absolute).catch(() => absolute)
  if (found.isDirectory()) return { folder: canonical }
  const parent = path.dirname(canonical)
  const git = await runGit(['rev-parse', '--show-toplevel'], parent)
  const root = git.code === 0 && git.stdout.trim() ? path.resolve(parent, git.stdout.trim()) : parent
  const relative = path.relative(root, canonical)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return { folder: parent, file: path.basename(canonical) }
  }
  return { folder: root, file: relative.split(path.sep).join('/') }
}

export class FinderOpens {
  private started = false
  private targets: string[] = []
  private draining: Promise<number> | null = null

  constructor(private readonly open: (request: OpenRequest) => void) {}

  get waiting(): boolean {
    return this.targets.length > 0
  }

  add(target: string): void {
    this.targets.push(target)
    if (this.started) void this.drain()
  }

  start(): Promise<number> {
    this.started = true
    return this.drain()
  }

  private drain(): Promise<number> {
    if (this.draining) return this.draining
    this.draining = this.read().finally(() => {
      this.draining = null
      if (this.started && this.targets.length > 0) void this.drain()
    })
    return this.draining
  }

  private async read(): Promise<number> {
    let opened = 0
    while (this.targets.length > 0) {
      const target = this.targets.shift()
      if (!target) continue
      const request = await finderOpenRequest(target)
      if (!request) continue
      this.open(request)
      opened += 1
    }
    return opened
  }
}
