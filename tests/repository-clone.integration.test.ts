import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { cloneRepository, repositoryName } from '../src/main/repository-clone'
import { git, initRepo } from './helpers/git'
import { tmpDir } from './helpers/session'

describe('repository cloning', () => {
  it('finds the project name in HTTPS, SSH and file remotes', () => {
    expect(repositoryName('https://github.com/owner/project.git')).toBe('project')
    expect(repositoryName('git@github.com:owner/project.git')).toBe('project')
    expect(repositoryName('ssh://git@github.com/owner/project.git/')).toBe('project')
    expect(repositoryName('file:///Users/jamel/My%20Project.git')).toBe('My Project')
  })

  it('clones into a project-named folder under the chosen location', async () => {
    const origin = tmpDir('clone-origin')
    const parent = tmpDir('clone-parent')
    await initRepo(origin)
    fs.writeFileSync(path.join(origin, 'work.ts'), 'export const ready = true\n')
    await git(origin, ['add', '-A'])
    await git(origin, ['commit', '-m', 'work'])

    const cloned = await cloneRepository(origin, parent)

    expect(cloned).toBe(path.join(parent, path.basename(origin)))
    expect(fs.readFileSync(path.join(cloned, 'work.ts'), 'utf8')).toBe('export const ready = true\n')
    expect((await git(cloned, ['rev-parse', '--is-inside-work-tree'])).trim()).toBe('true')
  })

  it('reports Git failures and leaves an existing folder untouched', async () => {
    const parent = tmpDir('clone-existing')
    const existing = path.join(parent, 'project')
    fs.mkdirSync(existing)
    fs.writeFileSync(path.join(existing, 'kept.txt'), 'kept\n')

    await expect(cloneRepository('https://example.invalid/project.git', parent)).rejects.toThrow(
      /already exists and is not an empty directory/
    )
    expect(fs.readFileSync(path.join(existing, 'kept.txt'), 'utf8')).toBe('kept\n')
  })
})
