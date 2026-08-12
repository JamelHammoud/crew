import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOCAL_TOOLS, runTool } from '../src/runner/providers/local-tools'
import { fileChanges, stepTodos } from '../src/runner/providers/detail'
import { isShellTool } from '../src/shared/tools'
import { tmpDir } from './helpers/session'

function write(root: string, file: string, body: string): string {
  const target = path.join(root, file)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, body)
  return target
}

function project(): string {
  const root = tmpDir('tools')
  write(root, 'notes.md', 'hello\nthere\n')
  write(root, 'src/app.ts', 'export const x = 1\nexport const y = 2\n')
  write(root, 'src/deep/panel.tsx', 'export const panel = true\n')
  return root
}

describe('the tools a local model is given', () => {
  it('names the eight the app already reads', () => {
    expect(LOCAL_TOOLS.map(tool => tool.function.name)).toEqual([
      'Read',
      'Write',
      'Edit',
      'Bash',
      'Grep',
      'Glob',
      'LS',
      'TodoWrite'
    ])
    expect(LOCAL_TOOLS.every(tool => tool.type === 'function')).toBe(true)
  })

  it('asks for the argument names the steps, diffs and tickets are folded out of', () => {
    const named = (name: string): Record<string, unknown> => {
      const tool = LOCAL_TOOLS.find(entry => entry.function.name === name)
      if (!tool) throw new Error(`no ${name}`)
      return (tool.function.parameters as { properties: Record<string, unknown> }).properties
    }
    expect(Object.keys(named('Read'))).toEqual(['file_path', 'offset', 'limit'])
    expect(Object.keys(named('Write'))).toEqual(['file_path', 'content'])
    expect(Object.keys(named('Edit'))).toEqual(['file_path', 'old_string', 'new_string', 'replace_all'])
    expect(Object.keys(named('Bash'))).toEqual(['command', 'description', 'timeout'])
    expect(Object.keys(named('Grep'))).toEqual(['pattern', 'path', 'glob'])
    expect(Object.keys(named('Glob'))).toEqual(['pattern', 'path'])
    expect(Object.keys(named('LS'))).toEqual(['path'])
    expect(Object.keys(named('TodoWrite'))).toEqual(['todos'])
  })

  it('speaks names the app already knows what to do with', () => {
    expect(isShellTool('Bash')).toBe(true)
    expect(isShellTool('Read')).toBe(false)
    const edit = fileChanges('Edit', { file_path: 'src/app.ts', old_string: 'const x = 1', new_string: 'const x = 2' })
    expect(edit).toEqual([{ path: 'src/app.ts', added: 1, removed: 1, diff: '- const x = 1\n+ const x = 2' }])
    const wrote = fileChanges('Write', { file_path: 'notes.md', content: 'one\ntwo\n' })
    expect(wrote?.[0]).toMatchObject({ path: 'notes.md', added: 3, removed: 0 })
    expect(
      stepTodos({ todos: [{ content: 'Draw the rows', activeForm: 'Drawing the rows', status: 'in_progress' }] })
    ).toEqual([{ text: 'Draw the rows', status: 'doing' }])
  })
})

describe('Write and Read', () => {
  it('writes a file and reads it back as it stands', async () => {
    const root = project()
    const wrote = await runTool('Write', { file_path: 'made/up/fresh.ts', content: 'export const z = 3\n' }, root)
    expect(wrote.ok).toBe(true)
    const read = await runTool('Read', { file_path: 'made/up/fresh.ts' }, root)
    expect(read.ok).toBe(true)
    expect(read.output).toBe('export const z = 3\n')
  })

  it('reads from a line and for a count of lines', async () => {
    const root = project()
    await runTool('Write', { file_path: 'many.txt', content: 'one\ntwo\nthree\nfour\n' }, root)
    const read = await runTool('Read', { file_path: 'many.txt', offset: 2, limit: 2 }, root)
    expect(read.output).toBe('two\nthree')
  })

  it('says so rather than throwing when the file is not there', async () => {
    const root = project()
    const read = await runTool('Read', { file_path: 'nowhere.txt' }, root)
    expect(read.ok).toBe(false)
    expect(read.output).toContain('nowhere.txt')
  })
})

describe('Edit', () => {
  it('lands on the one occurrence', async () => {
    const root = project()
    const edit = await runTool(
      'Edit',
      { file_path: 'src/app.ts', old_string: 'export const y = 2', new_string: 'export const y = 20' },
      root
    )
    expect(edit.ok).toBe(true)
    const read = await runTool('Read', { file_path: 'src/app.ts' }, root)
    expect(read.output).toBe('export const x = 1\nexport const y = 20\n')
  })

  it('says what went wrong when the old_string is not there', async () => {
    const root = project()
    const edit = await runTool(
      'Edit',
      { file_path: 'src/app.ts', old_string: 'export const q = 9', new_string: 'x' },
      root
    )
    expect(edit.ok).toBe(false)
    expect(edit.output).toContain('not in')
    const read = await runTool('Read', { file_path: 'src/app.ts' }, root)
    expect(read.output).toBe('export const x = 1\nexport const y = 2\n')
  })

  it('refuses an ambiguous match, and takes it with replace_all', async () => {
    const root = project()
    write(root, 'twice.ts', 'const a = 1\nconst a = 1\n')
    const refused = await runTool(
      'Edit',
      { file_path: 'twice.ts', old_string: 'const a = 1', new_string: 'const a = 2' },
      root
    )
    expect(refused.ok).toBe(false)
    expect(refused.output).toContain('2 times')
    expect((await runTool('Read', { file_path: 'twice.ts' }, root)).output).toBe('const a = 1\nconst a = 1\n')

    const took = await runTool(
      'Edit',
      { file_path: 'twice.ts', old_string: 'const a = 1', new_string: 'const a = 2', replace_all: true },
      root
    )
    expect(took.ok).toBe(true)
    expect((await runTool('Read', { file_path: 'twice.ts' }, root)).output).toBe('const a = 2\nconst a = 2\n')
  })
})

describe('Bash', () => {
  it('hands back what the command printed', async () => {
    const root = project()
    const ran = await runTool('Bash', { command: 'echo hello from the shell' }, root)
    expect(ran.ok).toBe(true)
    expect(ran.output).toContain('hello from the shell')
  })

  it('runs in the folder it was given', async () => {
    const root = project()
    const ran = await runTool('Bash', { command: 'cat notes.md' }, root)
    expect(ran.output).toContain('hello')
  })

  it('says a command failed rather than passing it off as output', async () => {
    const root = project()
    const ran = await runTool('Bash', { command: 'exit 3' }, root)
    expect(ran.ok).toBe(false)
    expect(ran.output).toContain('3')
  })
})

describe('Grep and Glob', () => {
  it('finds a real file by what is written in it', async () => {
    const root = project()
    const found = await runTool('Grep', { pattern: 'const panel' }, root)
    expect(found.ok).toBe(true)
    expect(found.output).toContain('src/deep/panel.tsx')
  })

  it('says nothing matched rather than failing', async () => {
    const root = project()
    const found = await runTool('Grep', { pattern: 'nothinghereatall' }, root)
    expect(found.ok).toBe(true)
    expect(found.output).toContain('No matches')
  })

  it('matches across folders with ** and within one name with *', async () => {
    const root = project()
    const deep = await runTool('Glob', { pattern: '**/*.ts' }, root)
    expect(deep.output.split('\n')).toContain('src/app.ts')
    const shallow = await runTool('Glob', { pattern: '*.md' }, root)
    expect(shallow.output.split('\n')).toEqual(['notes.md'])
  })

  it('says nothing matched rather than failing', async () => {
    const root = project()
    const found = await runTool('Glob', { pattern: '**/*.rs' }, root)
    expect(found.ok).toBe(true)
    expect(found.output).toContain('Nothing matches')
  })
})

describe('LS', () => {
  it('lists a folder, marking which entries are folders', async () => {
    const root = project()
    const listed = await runTool('LS', {}, root)
    expect(listed.output.split('\n')).toEqual(['src/', 'notes.md'])
  })
})

describe('TodoWrite', () => {
  it('keeps nothing and says the list landed', async () => {
    const root = project()
    const said = await runTool(
      'TodoWrite',
      { todos: [{ content: 'Draw the rows', activeForm: 'Drawing the rows', status: 'in_progress' }] },
      root
    )
    expect(said.ok).toBe(true)
  })
})

describe('where a path lands', () => {
  it('follows an absolute path outside the folder it was given', async () => {
    const root = project()
    const elsewhere = tmpDir('outside')
    const file = path.join(elsewhere, 'away.txt')
    const wrote = await runTool('Write', { file_path: file, content: 'over here\n' }, root)
    expect(wrote.ok).toBe(true)
    const read = await runTool('Read', { file_path: file }, root)
    expect(read.output).toBe('over here\n')
    expect((await runTool('LS', { path: elsewhere }, root)).output.split('\n')).toContain('away.txt')
    expect(path.isAbsolute(file)).toBe(true)
  })
})

describe('a tool nobody has heard of', () => {
  it('comes back as a sentence rather than a throw', async () => {
    const root = project()
    const said = await runTool('Frobnicate', {}, root)
    expect(said.ok).toBe(false)
    expect(said.output).toContain('Frobnicate')
    expect(said.output).toContain('Read')
  })
})
