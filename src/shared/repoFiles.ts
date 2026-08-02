import { promises as fs } from 'node:fs'
import path from 'node:path'
import { runGit } from './git'

export const MAX_LISTED = 20000
const NEVER_LISTED = new Set(['.git', 'node_modules'])

async function walk(root: string, prefix: string, found: string[]): Promise<void> {
  const dirents = await fs.readdir(path.join(root, prefix), { withFileTypes: true }).catch(() => [])
  for (const entry of dirents) {
    if (found.length >= MAX_LISTED) return
    if (NEVER_LISTED.has(entry.name)) continue
    const child = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) await walk(root, child, found)
    else if (entry.isFile()) found.push(child)
  }
}

// Every file the project is made of, for the filter to search. Git already
// knows which ones those are and leaves out everything .gitignore covers, so a
// folder that is not a repository is the only one walked by hand.
export async function listRepoFiles(root: string): Promise<string[]> {
  const listed = await runGit(['ls-files', '-co', '--exclude-standard', '-z'], root)
  if (listed.code === 0) {
    return listed.stdout.split('\0').filter(Boolean).slice(0, MAX_LISTED).sort()
  }
  const found: string[] = []
  await walk(root, '', found)
  return found.sort()
}
