import { existsSync } from 'node:fs'
import path from 'node:path'
import { runGit } from './git'

export interface InterruptedState {
  label: string
  abort: string[]
}

const STATES: Array<InterruptedState & { file: string }> = [
  { file: 'rebase-merge', label: 'rebase', abort: ['rebase', '--abort'] },
  { file: 'rebase-apply', label: 'rebase', abort: ['rebase', '--abort'] },
  { file: 'MERGE_HEAD', label: 'merge', abort: ['merge', '--abort'] },
  { file: 'CHERRY_PICK_HEAD', label: 'cherry-pick', abort: ['cherry-pick', '--abort'] },
  { file: 'REVERT_HEAD', label: 'revert', abort: ['revert', '--abort'] }
]

export async function interruptedStates(repoPath: string): Promise<InterruptedState[]> {
  const dir = await runGit(['rev-parse', '--absolute-git-dir'], repoPath)
  if (dir.code !== 0 || !dir.stdout.trim()) return []
  const root = path.resolve(repoPath, dir.stdout.trim())
  const found = new Map<string, InterruptedState>()
  for (const state of STATES) {
    if (!existsSync(path.join(root, state.file))) continue
    if (!found.has(state.label)) found.set(state.label, { label: state.label, abort: state.abort })
  }
  return [...found.values()]
}

export async function rebaseActive(repoPath: string): Promise<boolean> {
  return (await interruptedStates(repoPath)).some(state => state.label === 'rebase')
}
