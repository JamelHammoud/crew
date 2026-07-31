import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import { runGit } from '../shared/git'
import { cleanCrewRemote } from '../shared/project'

export const CREW_ATTRIBUTES = '*.jsonl merge=union\n'

export interface CrewRepoResult {
  ok: boolean
  message: string
  address: string
}

export function crewHere(base: string): boolean {
  return existsSync(path.join(base, '.crew'))
}

export async function crewRepoUrl(base: string): Promise<string | null> {
  if (!existsSync(path.join(base, '.git'))) return null
  const url = await runGit(['remote', 'get-url', 'origin'], base)
  if (url.code !== 0) return null
  return url.stdout.trim() || null
}

export async function cloneCrew(remote: string, base: string): Promise<CrewRepoResult> {
  const address = cleanCrewRemote(remote)
  if (!address) return { ok: false, message: 'That is not an address a crew can be kept at.', address: '' }
  const stood = existsSync(base)
  await fs.mkdir(path.dirname(base), { recursive: true })
  const clone = await runGit(['clone', address, base], path.dirname(base))
  if (clone.code !== 0) {
    if (!stood) await fs.rm(base, { force: true, recursive: true }).catch(() => {})
    return { ok: false, message: 'This crew is private, and this computer cannot reach it.', address }
  }
  return { ok: true, message: '', address }
}

export async function publishCrew(base: string, remote: string): Promise<CrewRepoResult> {
  const address = cleanCrewRemote(remote)
  if (!address) return { ok: false, message: 'That is not an address a crew can be kept at.', address: '' }
  if (await crewRepoUrl(base)) {
    return { ok: false, message: 'This crew already has a repo of its own.', address }
  }
  const listed = await runGit(['ls-remote', address], base)
  if (listed.code !== 0) return { ok: false, message: 'Could not reach that repo.', address }
  if (listed.stdout.trim()) {
    return { ok: false, message: 'That repo already has something in it. Make an empty one for this crew.', address }
  }
  if (!existsSync(path.join(base, '.git'))) {
    const init = await runGit(['init', '-b', 'main'], base)
    if (init.code !== 0) return { ok: false, message: 'Could not start a repo for this crew.', address }
  }
  const saved = await commitCrew(base)
  if (!saved) return { ok: false, message: 'Could not save this crew.', address }
  const origin = await runGit(['remote', 'add', 'origin', address], base)
  if (origin.code !== 0) return { ok: false, message: 'Could not point this crew at that repo.', address }
  const push = await runGit(['push', '-u', 'origin', 'HEAD'], base)
  if (push.code !== 0) {
    await runGit(['remote', 'remove', 'origin'], base)
    return { ok: false, message: 'Could not put this crew in that repo.', address }
  }
  return { ok: true, message: '', address }
}

async function commitCrew(base: string): Promise<boolean> {
  const add = await runGit(['add', '-A'], base)
  if (add.code !== 0) return false
  const staged = await runGit(['diff', '--cached', '--quiet'], base)
  if (staged.code === 0) {
    const head = await runGit(['rev-parse', '--verify', 'HEAD'], base)
    return head.code === 0
  }
  const commit = await runGit(['commit', '-m', 'crew'], base)
  return commit.code === 0
}
