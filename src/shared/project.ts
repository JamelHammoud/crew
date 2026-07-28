import { createHash } from 'node:crypto'
import path from 'node:path'
import { runGit } from './git'

// Where a project's crew lives. In the folder is the shared one: chat, docs and
// boards ride in `.crew` and go out with the repo. On this machine is the same
// crew kept beside the app, so nothing is ever written into the project and git
// is never run.
export type CrewHome = 'folder' | 'private'

// A private crew is keyed on the repo's first commit rather than on where the
// folder happens to sit, so moving or recloning a project keeps its history. A
// folder with no commit yet has nothing to key on, so it takes a hash of its
// path and the key is remembered from then on.
export async function projectKey(folder: string): Promise<string> {
  const result = await runGit(['rev-list', '--max-parents=0', 'HEAD'], folder)
  const roots = result.code === 0 ? result.stdout.trim().split('\n') : []
  const genesis = roots.map(line => line.trim()).filter(line => /^[0-9a-f]{40}$/.test(line)).at(-1)
  if (genesis) return genesis.slice(0, 16)
  return createHash('sha256').update(path.resolve(folder)).digest('hex').slice(0, 16)
}
