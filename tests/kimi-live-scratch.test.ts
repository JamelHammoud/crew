import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { kimiProvider } from '../src/runner/providers/kimi'
import type { RunStep } from '../src/shared/llm'

describe('kimi runs for real through the provider', () => {
  it('streams thinking, names tools, carries a diff and counts tokens', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'kimi-live-'))
    writeFileSync(join(cwd, 'math.js'), 'export function add(a, b) {\n  return a - b\n}\n')

    const steps: RunStep[] = []
    const tokens: Array<[number, number | null]> = []
    const run = kimiProvider.start(
      'Read math.js, think about whether add() is correct, then fix the bug with an edit. Then run "echo done" in the shell.',
      cwd,
      { onStep: step => steps.push(step), onTokens: (t, c) => tokens.push([t, c]) }
    )
    const result = await run.done

    const thinking = steps.filter(s => s.kind === 'thinking')
    const named = steps.filter(s => s.name)
    const withFiles = steps.filter(s => s.files?.length)
    const shell = steps.filter(s => s.output)

    console.log('answer:', JSON.stringify(result.text.slice(0, 200)))
    console.log('steps:', steps.length, 'thinking:', thinking.length)
    console.log('thinking text:', JSON.stringify(thinking.map(s => s.text ?? '').join('').slice(0, 160)))
    console.log('tools:', [...new Set(named.map(s => s.name))].join(', '))
    console.log('files:', JSON.stringify(withFiles.map(s => s.files)))
    console.log('shell output:', JSON.stringify(shell.map(s => s.output).slice(0, 2)))
    console.log('tokens:', JSON.stringify(tokens.slice(-3)))
    console.log('file now:', JSON.stringify(readFileSync(join(cwd, 'math.js'), 'utf8')))

    expect(thinking.length).toBeGreaterThan(0)
    expect(readFileSync(join(cwd, 'math.js'), 'utf8')).toContain('a + b')
    expect(withFiles.length).toBeGreaterThan(0)
    expect(tokens.length).toBeGreaterThan(0)
  }, 300000)
})
