import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { runGit } from './git'

// Where a project's crew lives. In the folder is the shared one: chat, docs and
// boards ride in `.crew` and go out with the repo. On this machine is the same
// crew kept beside the app, so nothing is ever written into the project and git
// is never run.
export type CrewHome = 'folder' | 'private'

// The one file a project carries about its crew: an address, and nothing else.
// No branch, no key and nobody's name, because anything more is something two
// machines can disagree about.
export const CREW_POINTER = '.crew.json'

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

// An address is not a secret. What decides who may read a crew is the repo it
// names, so the pointer rides in the project where everyone who clones it finds
// it. The one place a crew's address is decided, so the same rule holds
// wherever one is written down, read back or pushed to.
export function cleanCrewRemote(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || /\s/.test(text)) return null
  // The ssh forms are turned over to https. An address is written for everybody
  // else, and a machine without that key is locked out of one that works fine
  // for the rest of them.
  const url = /^ssh:\/\/(?:[\w.+-]+@)?([\w.-]+)(?::\d+)?\/(\S+)$/.exec(text)
  if (url) return `https://${url[1]}/${url[2]}`
  const scp = /^[\w.+-]+@([\w.-]+):(?!\/)(\S+)$/.exec(text)
  if (scp) return `https://${scp[1]}/${scp[2]}`
  if (/^https?:\/\/[\w.-]+(?::\d+)?\/\S+$/.test(text)) return text
  // A repo on this machine is still an address rather than a path, so it is
  // written the one way git can be handed it from anywhere.
  if (/^file:\/\/\/\S+$/.test(text)) return text
  return null
}

export async function readCrewRemote(folder: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(folder, CREW_POINTER), 'utf8')
    return cleanCrewRemote((JSON.parse(raw) as { crew?: unknown } | null)?.crew)
  } catch {
    return null
  }
}

export async function writeCrewRemote(folder: string, remote: string): Promise<void> {
  const file = path.join(folder, CREW_POINTER)
  await fs.writeFile(file, `${JSON.stringify({ crew: remote }, null, 2)}\n`)
}
