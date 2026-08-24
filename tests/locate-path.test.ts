import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { locatePath } from '../src/main/locate'
import { personalPath } from '../src/shared/files'

let root = ''

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'crew-locate-'))
  await fs.mkdir(path.join(root, 'src'), { recursive: true })
  await fs.writeFile(path.join(root, 'src', 'app.ts'), 'export {}\n')
})

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('a path an agent mentioned', () => {
  it('shows a file in this project relative to it', async () => {
    expect(await locatePath(root, path.join(root, 'src', 'app.ts'))).toEqual({
      kind: 'repo',
      path: 'src/app.ts',
      exists: true,
      dir: false
    })
  })

  it('finds the same file under another computer’s prefix', async () => {
    expect(await locatePath(root, '/Users/ali/projects/crew/src/app.ts')).toEqual({
      kind: 'repo',
      path: 'src/app.ts',
      exists: true,
      dir: false
    })
  })

  it('covers over a file in somebody else’s own folder', async () => {
    expect(await locatePath(root, '/Users/ali/Desktop/notes.md')).toEqual({ kind: 'private' })
    expect(await locatePath(root, 'C:\\Users\\Ali Hammoud\\Desktop\\notes.md')).toEqual({ kind: 'private' })
  })

  it('leaves an address a server answers on as it was written', async () => {
    for (const target of ['/agents/spawn', '/api/v1/sessions/prompts', '/users/12/posts', '/code-review/ultra']) {
      expect(await locatePath(root, target)).toEqual({ kind: 'local', exists: false, dir: false })
    }
  })

  it('leaves a folder nobody here has as it was written', async () => {
    expect(await locatePath(root, '/opt/ali/tools')).toEqual({ kind: 'local', exists: false, dir: false })
    expect(await locatePath(root, '/Users/ali/Desktop')).toEqual({ kind: 'local', exists: false, dir: false })
  })

  it('tells a project folder from a file', async () => {
    expect(await locatePath(root, root)).toEqual({ kind: 'repo', path: '.', exists: true, dir: true })
    expect(await locatePath(root, path.join(root, 'src'))).toEqual({ kind: 'repo', path: 'src', exists: true, dir: true })
  })
})

describe('somebody’s own file', () => {
  it('is a named file under a home folder and nothing else', () => {
    expect(personalPath('/Users/ali/Desktop/notes.md')).toBe(true)
    expect(personalPath('/home/ali/notes.md')).toBe(true)
    expect(personalPath('C:\\Users\\Ali Hammoud\\Desktop\\notes.md')).toBe(true)
    expect(personalPath('/users/12/posts')).toBe(false)
    expect(personalPath('/home/settings')).toBe(false)
    expect(personalPath('/agents/spawn')).toBe(false)
    expect(personalPath('/Users/ali/bin/tool')).toBe(false)
  })
})
