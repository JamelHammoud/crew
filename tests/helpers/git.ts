import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

export async function initRepo(dir: string): Promise<void> {
  fs.mkdirSync(dir, { recursive: true })
  await git(dir, ['init', '-b', 'main'])
  await git(dir, ['config', 'user.email', 'crew@test.local'])
  await git(dir, ['config', 'user.name', 'crew test'])
  fs.writeFileSync(path.join(dir, '.gitattributes'), '*.jsonl merge=union\n')
  await git(dir, ['add', '-A'])
  await git(dir, ['commit', '-m', 'start'])
}

export async function initBare(dir: string): Promise<void> {
  fs.mkdirSync(dir, { recursive: true })
  await git(dir, ['init', '--bare', '-b', 'main'])
}

export async function clone(origin: string, dest: string): Promise<void> {
  await git(path.dirname(dest), ['clone', origin, path.basename(dest)])
  await git(dest, ['config', 'user.email', 'crew@test.local'])
  await git(dest, ['config', 'user.name', 'crew test'])
}
