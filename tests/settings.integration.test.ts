import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import { claudeArgs, claudeFields } from '../src/runner/providers/claude'
import { codexArgs } from '../src/runner/providers/codex'
import { kimiArgs } from '../src/runner/providers/kimi'
import { kimiModels } from '../src/runner/providers/kimi-models'
import type { SessionEvent } from '../src/shared/events'
import { agentId, resolveSettings } from '../src/shared/llm'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

const reader = (settings: Record<string, string>) => (key: string) => settings[key] ?? ''

describe('provider settings map to command line flags', () => {
  it('claude sends model, thinking, and bypassed permissions', () => {
    const args = claudeArgs('hi', reader({ model: 'sonnet', effort: 'max' }))
    expect(args).toContain('--dangerously-skip-permissions')
    expect(args.join(' ')).toContain('--permission-mode bypassPermissions')
    expect(args.join(' ')).toContain('--model sonnet')
    expect(args.join(' ')).toContain('--effort max')
  })

  it('kimi approves every action and passes the model alias', () => {
    const args = kimiArgs('hi', reader({ model: 'kimi-code/k3' }))
    expect(args).toContain('--yolo')
    expect(args.join(' ')).toContain('--model kimi-code/k3')
  })

  it('codex bypasses approvals and sets reasoning effort', () => {
    const args = codexArgs('hi', reader({ model: '', effort: 'low' }))
    expect(args).toContain('--dangerously-bypass-approvals-and-sandbox')
    expect(args.join(' ')).toContain('model_reasoning_effort="low"')
    expect(args).not.toContain('--model')
  })

  it('leaves a flag off when the value is empty', () => {
    expect(claudeArgs('hi', reader({ model: '', effort: 'high' }))).not.toContain('--model')
  })

  it('falls back to the default when a value is not one of the options', () => {
    const resolved = resolveSettings(claudeFields(), { model: 'gpt-4', effort: 'medium' })
    expect(resolved).toEqual({ model: 'opus', effort: 'medium' })
  })

  it('reads kimi model aliases from the config file', () => {
    expect(kimiModels('/nowhere')).toEqual([])
  })
})

describe('settings across the session', () => {
  let host: TestHost
  let runners: Runner[] = []
  let uis: TestUi[] = []

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.close()
    uis = []
    runners = []
    await host.close()
  })

  async function connectRunner(name: string) {
    const runner = new Runner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await new Promise<void>(resolve => {
      runner.onStatus = status => {
        if (status === 'online') resolve()
      }
    })
    return runner
  }

  it('shares an agent setting with everyone and uses it on the next prompt', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const ali = await TestUi.connect(host.url, 'ali', host.code)
    uis.push(sam, ali)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake')

    const id = agentId('jamel', 'fake')
    sam.send({ type: 'agent.settings', agentId: id, settings: { model: 'large' } })

    const updated = (await ali.waitForEvent(e => e.kind === 'agent.updated')) as Extract<
      SessionEvent,
      { kind: 'agent.updated' }
    >
    expect(updated.settings.model).toBe('large')

    ali.chat('run it @Fake', [id])
    const end = (await ali.waitForEvent(e => e.kind === 'agent.end')) as Extract<
      SessionEvent,
      { kind: 'agent.end' }
    >
    expect(end.ok).toBe(true)
    expect(end.text).toContain('flags: --model large')
  })

  it('ignores a setting the provider does not offer', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake')

    const id = agentId('jamel', 'fake')
    sam.send({ type: 'agent.settings', agentId: id, settings: { model: 'huge', nonsense: 'x' } })

    const updated = (await sam.waitForEvent(e => e.kind === 'agent.updated')) as Extract<
      SessionEvent,
      { kind: 'agent.updated' }
    >
    expect(updated.settings).toEqual({ model: '' })
  })
})
