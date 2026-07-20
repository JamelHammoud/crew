import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseClaudeLine } from '../src/runner/providers/claude'
import { parseKimiLine } from '../src/runner/providers/kimi'
import { tmpDir } from './helpers/session'
import { makeFakeProvider, fakeCliPath } from './helpers/fake-provider'
import { commandExists } from '../src/runner/providers/cli'
import { crewPath, resolveCommand } from '../src/runner/providers/path'

describe('fake provider contract', () => {
  const repo = tmpDir('providers')

  it('detects and runs, streaming chunks in order', async () => {
    const provider = makeFakeProvider()
    expect(await provider.detect()).toBe(true)
    const chunks: string[] = []
    const run = provider.start('hello there', repo, {
      onStep: step => {
        if (step.kind === 'text' && step.text) chunks.push(step.text)
      }
    })
    const { text } = await run.done
    expect(chunks).toEqual(['fake[', 'hello there', ']'])
    expect(text).toBe('fake[\nhello there\n]')
  })

  it('reports tool steps with start and finish', async () => {
    const provider = makeFakeProvider({ FAKE_CLI_ACTIVITY: '1' })
    const steps: Array<{ name?: string; status: string }> = []
    const run = provider.start('work', repo, {
      onStep: step => {
        if (step.kind === 'tool' || step.kind === 'subagent') steps.push({ name: step.name, status: step.status })
      }
    })
    await run.done
    expect(steps).toContainEqual({ name: 'Helper', status: 'running' })
    expect(steps.filter(s => s.status === 'done').length).toBe(2)
  })

  it('reports thinking as its own step', async () => {
    const provider = makeFakeProvider({ FAKE_CLI_THINK: '1' })
    const thoughts: string[] = []
    const run = provider.start('ponder', repo, {
      onStep: step => {
        if (step.kind === 'thinking' && step.text) thoughts.push(step.text)
      }
    })
    const { text } = await run.done
    expect(thoughts).toEqual(['weighing the options'])
    expect(text).not.toContain('weighing the options')
  })

  it('rejects with stderr on failure', async () => {
    const provider = makeFakeProvider({ FAKE_CLI_FAIL: '1' })
    const run = provider.start('boom', repo, { onStep: () => {} })
    await expect(run.done).rejects.toThrow('fake cli failed')
  })

  it('kill stops the run and rejects with Stopped', async () => {
    const provider = makeFakeProvider({ FAKE_CLI_DELAY_MS: '300' })
    const run = provider.start('slow', repo, { onStep: () => {} })
    run.kill()
    await expect(run.done).rejects.toThrow('Stopped')
  })
})

describe('kimi parser matches the real CLI format', () => {
  it('parses text, tool calls, and tool results', () => {
    expect(parseKimiLine('{"role":"assistant","content":"ok"}')).toEqual([{ text: 'ok' }])

    const toolCall = parseKimiLine(
      '{"role":"assistant","tool_calls":[{"type":"function","id":"tool_123","function":{"name":"Glob","arguments":"{\\"pattern\\":\\"*.md\\"}"}}]}'
    )
    expect(toolCall).toEqual([
      { activity: { id: 'tool_123', kind: 'tool', name: 'Glob', status: 'started', detail: '*.md' } }
    ])

    const subagent = parseKimiLine(
      '{"role":"assistant","tool_calls":[{"type":"function","id":"tool_9","function":{"name":"Agent","arguments":"{\\"prompt\\":\\"look around\\"}"}}]}'
    )
    expect(subagent[0].activity?.kind).toBe('subagent')

    expect(parseKimiLine('{"role":"tool","tool_call_id":"tool_123","content":"AGENTS.md"}')).toEqual([
      { activity: { id: 'tool_123', kind: 'tool', name: '', status: 'finished' } }
    ])

    expect(parseKimiLine('{"role":"meta","type":"session.resume_hint"}')).toEqual([])
  })
})

describe('claude parser matches the real CLI format', () => {
  it('parses text blocks, tool use, and tool results', () => {
    const text = parseClaudeLine(
      '{"type":"assistant","message":{"content":[{"type":"text","text":"ok"}],"role":"assistant"}}'
    )
    expect(text).toEqual([{ text: 'ok' }])

    const toolUse = parseClaudeLine(
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_1","name":"Bash","input":{"command":"ls -la"}}]}}'
    )
    expect(toolUse).toEqual([
      { activity: { id: 'toolu_1', kind: 'tool', name: 'Bash', status: 'started', detail: 'ls -la' } }
    ])

    const task = parseClaudeLine(
      '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_2","name":"Task","input":{"description":"Explore the repo"}}]}}'
    )
    expect(task[0].activity?.kind).toBe('subagent')
    expect(task[0].activity?.detail).toBe('Explore the repo')

    const result = parseClaudeLine(
      '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"done"}]}}'
    )
    expect(result).toEqual([{ activity: { id: 'toolu_1', kind: 'tool', name: '', status: 'finished' } }])

    const thinking = parseClaudeLine(
      '{"type":"assistant","message":{"content":[{"type":"thinking","thinking":"let me check"},{"type":"text","text":"ok"}]}}'
    )
    expect(thinking).toEqual([{ thinking: 'let me check' }, { text: 'ok' }])

    expect(parseClaudeLine('{"type":"system","subtype":"init"}')).toEqual([])
    expect(parseClaudeLine('{"type":"result","subtype":"success","result":"ok"}')).toEqual([])
  })
})

const REAL = process.env.CREW_REAL_CLI === '1'
const realCli = (name: string) => (REAL && commandExists(name) ? it : it.skip)

describe('real CLI smoke (CREW_REAL_CLI=1)', () => {
  realCli('kimi')(
    'kimi answers',
    async () => {
      const { kimiProvider } = await import('../src/runner/providers/kimi')
      const run = kimiProvider.start('Reply with exactly: crew-ok', tmpDir('real-kimi'), { onStep: () => {} })
      const { text } = await run.done
      expect(text).toContain('crew-ok')
    },
    90000
  )

  realCli('claude')(
    'claude answers',
    async () => {
      const { claudeProvider } = await import('../src/runner/providers/claude')
      const run = claudeProvider.start('Reply with exactly: crew-ok', tmpDir('real-claude'), { onStep: () => {} })
      const { text } = await run.done
      expect(text).toContain('crew-ok')
    },
    90000
  )
})

describe('cli detection outside the app PATH', () => {
  const home = process.env.HOME
  const envPath = process.env.PATH
  const shell = process.env.SHELL

  afterEach(() => {
    process.env.HOME = home
    process.env.PATH = envPath
    if (shell === undefined) delete process.env.SHELL
    else process.env.SHELL = shell
  })

  it('finds a cli installed in the home bin dirs when PATH is bare', () => {
    const fakeHome = tmpDir('home')
    const bin = path.join(fakeHome, '.local/bin')
    fs.mkdirSync(bin, { recursive: true })
    const tool = path.join(bin, 'crewtool')
    fs.writeFileSync(tool, '#!/bin/sh\necho ok\n')
    fs.chmodSync(tool, 0o755)

    process.env.HOME = fakeHome
    process.env.PATH = '/usr/bin:/bin'
    delete process.env.SHELL

    expect(commandExists('crewtool')).toBe(true)
    expect(resolveCommand('crewtool')).toBe(tool)
    expect(crewPath().split(':')).toContain(bin)
    expect(commandExists('crewtool-missing')).toBe(false)
  })

  it('ignores directories and non executable files', () => {
    const fakeHome = tmpDir('home')
    const bin = path.join(fakeHome, '.local/bin')
    fs.mkdirSync(path.join(bin, 'crewdir'), { recursive: true })
    fs.writeFileSync(path.join(bin, 'crewplain'), 'not executable')
    fs.chmodSync(path.join(bin, 'crewplain'), 0o644)

    process.env.HOME = fakeHome
    process.env.PATH = '/usr/bin:/bin'
    delete process.env.SHELL

    expect(commandExists('crewdir')).toBe(false)
    expect(commandExists('crewplain')).toBe(false)
  })
})

describe('fake cli is on disk for spawned tests', () => {
  it('exists', () => {
    expect(fakeCliPath.endsWith('fake-cli.mjs')).toBe(true)
  })
})
