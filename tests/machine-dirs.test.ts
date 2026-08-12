import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readMachineDirs } from '../src/main/files'

const home = process.env.HOME
let temp = ''

beforeAll(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'crew-machine-'))
  await fs.mkdir(path.join(temp, 'Documents', 'Repositories'), { recursive: true })
  await fs.writeFile(path.join(temp, 'notes.txt'), 'x')
  await fs.writeFile(path.join(temp, '.zshrc'), 'x')
  await fs.symlink(path.join(temp, 'Documents'), path.join(temp, 'papers'))
  process.env.HOME = temp
})

afterAll(async () => {
  process.env.HOME = home
  await fs.rm(temp, { recursive: true, force: true })
})

describe('reading a folder off this machine', () => {
  it('reads a folder named in full', async () => {
    const [dir] = await readMachineDirs(null, path.join(temp, 'Documents'))
    expect(dir.entries).toEqual([{ name: 'Repositories', dir: true }])
    expect(dir.repoDir).toBeNull()
  })

  it('holds the folders above the files and hands back the hidden ones too', async () => {
    const [dir] = await readMachineDirs(null, temp)
    expect(dir.entries.map(entry => entry.name)).toEqual(['Documents', 'papers', '.zshrc', 'notes.txt'])
  })

  it('reads a link to a folder as a folder', async () => {
    const [dir] = await readMachineDirs(null, temp)
    expect(dir.entries.find(entry => entry.name === 'papers')?.dir).toBe(true)
  })

  it('reads a leading slash at the root and then under your own folder', async () => {
    expect((await readMachineDirs(null, '/Documents')).map(dir => dir.dir)).toEqual([path.join(temp, 'Documents')])
    expect((await readMachineDirs(null, '/')).map(dir => dir.dir)).toEqual(['/', temp])
  })

  it('reads a tilde as your own folder', async () => {
    const [dir] = await readMachineDirs(null, '~')
    expect(dir.dir).toBe(temp)
  })

  it('says where a folder sits in the project it is inside', async () => {
    const [inside] = await readMachineDirs(temp, path.join(temp, 'Documents'))
    expect(inside.repoDir).toBe('Documents')
    const [top] = await readMachineDirs(temp, temp)
    expect(top.repoDir).toBe('')
    const [outside] = await readMachineDirs(path.join(temp, 'Documents'), temp)
    expect(outside.repoDir).toBeNull()
  })

  it('answers with nothing for a folder that is not there', async () => {
    expect(await readMachineDirs(null, '/no/such/folder/here')).toEqual([])
  })
})
