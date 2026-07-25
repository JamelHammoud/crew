import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface GitResult {
  code: number
  stdout: string
  stderr: string
}

const GIT_TIMEOUT_MS = 120000
const LOCK_STALE_MS = 60000

export function runGit(args: string[], cwd: string): Promise<GitResult> {
  return new Promise(resolve => {
    execFile(
      'git',
      args,
      { cwd, timeout: GIT_TIMEOUT_MS, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (error, stdout, stderr) => {
        resolve({ code: error ? (error as { code?: number }).code ?? 1 : 0, stdout, stderr })
      }
    )
  })
}

export async function gitDir(repoPath: string): Promise<string | null> {
  const dir = await runGit(['rev-parse', '--absolute-git-dir'], repoPath)
  if (dir.code !== 0 || !dir.stdout.trim()) return null
  return path.resolve(repoPath, dir.stdout.trim())
}

// Several crew windows can watch one folder, and git refuses to run two of
// anything at once. Whoever holds this lock syncs; everyone else waits for the
// next pass rather than interleaving a fetch into someone else's rebase.
export async function takeSyncLock(repoPath: string): Promise<(() => Promise<void>) | null> {
  const dir = await gitDir(repoPath)
  if (!dir) return null
  const file = path.join(dir, 'crew-sync.lock')
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.open(file, 'wx')
      await handle.writeFile(String(process.pid))
      await handle.close()
      let released = false
      return async () => {
        if (released) return
        released = true
        await fs.rm(file, { force: true }).catch(() => {})
      }
    } catch {
      const stat = await fs.stat(file).catch(() => null)
      if (!stat || Date.now() - stat.mtimeMs < LOCK_STALE_MS) return null
      await fs.rm(file, { force: true }).catch(() => {})
    }
  }
  return null
}

export async function localPaths(repoPath: string): Promise<string[]> {
  const status = await runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all'], repoPath)
  if (status.code !== 0) return []
  const fields = status.stdout.split('\0').filter(Boolean)
  const paths: string[] = []
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index]
    paths.push(field.slice(3))
    if (/[RC]/.test(field.slice(0, 2))) {
      const previous = fields[++index]
      if (previous) paths.push(previous)
    }
  }
  return paths
}

export async function incomingPaths(repoPath: string): Promise<string[]> {
  const diff = await runGit(['diff', '--name-only', '-z', 'HEAD...@{upstream}'], repoPath)
  if (diff.code !== 0) return []
  return diff.stdout.split('\0').filter(Boolean)
}

export async function overwrittenPaths(repoPath: string): Promise<string[]> {
  const [local, incoming] = await Promise.all([localPaths(repoPath), incomingPaths(repoPath)])
  if (local.length === 0 || incoming.length === 0) return []
  const pending = new Set(local)
  return incoming.filter(file => pending.has(file)).sort()
}

export async function stashCount(repoPath: string): Promise<number> {
  const list = await runGit(['stash', 'list'], repoPath)
  if (list.code !== 0) return 0
  return list.stdout.trim() ? list.stdout.trim().split(/\r?\n/).length : 0
}

export async function restoreAutostash(repoPath: string, before: number): Promise<boolean> {
  if ((await stashCount(repoPath)) <= before) return false
  const newest = await runGit(['stash', 'list', '-1', '--format=%gs'], repoPath)
  if (!newest.stdout.includes('autostash')) return false
  const pop = await runGit(['stash', 'pop'], repoPath)
  return pop.code === 0
}
