import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import { claudeArgs, claudeFields } from '../src/runner/providers/claude'
import { codexArgs } from '../src/runner/providers/codex'
import { codexDialog } from '../src/runner/providers/codex-app'
import { kimiArgs } from '../src/runner/providers/kimi'
import { kimiDialog } from '../src/runner/providers/kimi-acp'
import { kimiModels } from '../src/runner/providers/kimi-models'
import type { SessionEvent } from '../src/shared/events'
import { agentId, resolveSettings, visibleSettingFields } from '../src/shared/llm'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

const reader = (settings: Record<string, string>) => (key: string) => settings[key] ?? ''

describe('provider settings map to command line flags', () => {
  it('claude sends model, thinking, and bypassed permissions', () => {
    const args = claudeArgs('hi', reader({ model: 'sonnet', effort: 'max' }))
    expect(args).toContain('--dangerously-skip-permissions')
    expect(args.join(' ')).toContain('--permission-mode bypassPermissions')
    expect(args.join(' ')).toContain('--model sonnet')
    expect(args.join(' ')).toContain('--effort max')
  })

  // Without this the thinking blocks still arrive, carrying an empty string, so
  // the thread shows a run that thinks in silence.
  it('claude asks for the thinking to be readable', () => {
    const args = claudeArgs('hi', reader({ model: 'opus', effort: 'high' }))
    expect(args.join(' ')).toContain('--thinking-display summarized')
  })

  it('claude sends the exact selected opus model', () => {
    const args = claudeArgs('hi', reader({ model: 'opus', opusModel: 'claude-opus-4-8', effort: 'high' }))
    expect(args.join(' ')).toContain('--model claude-opus-4-8')
  })

  it('claude ignores the opus version for another model family', () => {
    const args = claudeArgs('hi', reader({ model: 'sonnet', opusModel: 'claude-opus-4-8', effort: 'high' }))
    expect(args.join(' ')).toContain('--model sonnet')
    expect(args).not.toContain('claude-opus-4-8')
  })

  it('kimi walks the acp handshake and allows what it is asked', () => {
    expect(kimiArgs()).toEqual(['acp'])
    const dialog = kimiDialog('hi', '/tmp/work', reader({ model: 'kimi-code/k3' }))
    const sent: string[] = [...dialog.begin()]
    const init = JSON.parse(sent[0])
    expect(init.method).toBe('initialize')
    expect(init.params.clientCapabilities.fs).toEqual({ readTextFile: false, writeTextFile: false })

    sent.push(...dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: 1 } })))
    const session = JSON.parse(sent[sent.length - 1])
    expect(session.method).toBe('session/new')
    expect(session.params).toMatchObject({ cwd: '/tmp/work', mcpServers: [] })

    sent.push(...dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { sessionId: 's1' } })))
    const mode = JSON.parse(sent[sent.length - 1])
    expect(mode.method).toBe('session/set_config_option')
    expect(mode.params).toEqual({ sessionId: 's1', configId: 'mode', value: 'yolo' })

    sent.push(...dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 3, result: {} })))
    const picked = JSON.parse(sent[sent.length - 1])
    expect(picked.params).toEqual({ sessionId: 's1', configId: 'model', value: 'kimi-code/k3' })

    sent.push(...dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 4, result: {} })))
    const turn = JSON.parse(sent[sent.length - 1])
    expect(turn.method).toBe('session/prompt')
    expect(turn.params.sessionId).toBe('s1')
    expect(turn.params.prompt).toEqual([{ type: 'text', text: 'hi' }])

    const asked = {
      jsonrpc: '2.0',
      id: 9,
      method: 'session/request_permission',
      params: {
        sessionId: 's1',
        options: [
          { optionId: 'approve_once', kind: 'allow_once' },
          { optionId: 'approve_always', kind: 'allow_always' },
          { optionId: 'reject', kind: 'reject_once' }
        ]
      }
    }
    const [answer] = dialog.answer(JSON.stringify(asked))
    expect(JSON.parse(answer)).toEqual({
      jsonrpc: '2.0',
      id: 9,
      result: { outcome: { outcome: 'selected', optionId: 'approve_always' } }
    })
  })

  it('codex bypasses approvals and sets reasoning effort', () => {
    expect(codexArgs()).toEqual(['app-server'])
    const dialog = codexDialog('hi', '/tmp/work', reader({ model: 'gpt-5.6-sol', effort: 'low' }))
    const sent: string[] = [...dialog.begin()]
    sent.push(...dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })))
    const thread = JSON.parse(sent[sent.length - 1])
    expect(thread.method).toBe('thread/start')
    expect(thread.params).toMatchObject({ cwd: '/tmp/work', sandbox: 'danger-full-access', approvalPolicy: 'never' })
    expect(thread.params.model).toBe('gpt-5.6-sol')

    sent.push(...dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { thread: { id: 't1' } } })))
    const turn = JSON.parse(sent[sent.length - 1])
    expect(turn.method).toBe('turn/start')
    expect(turn.params).toMatchObject({ threadId: 't1', effort: 'low', approvalPolicy: 'never' })
    expect(turn.params.input).toEqual([{ type: 'text', text: 'hi' }])
  })

  it('leaves a flag off when the value is empty', () => {
    expect(claudeArgs('hi', reader({ model: '', effort: 'high' }))).not.toContain('--model')
  })

  it('keeps a model the CLI accepted before its current catalog was read', () => {
    const resolved = resolveSettings(claudeFields(), { model: 'gpt-4', effort: 'medium' })
    expect(resolved).toMatchObject({ model: 'gpt-4', effort: 'medium' })
  })

  it('keeps the retired opus version field out of settings', () => {
    const fields = claudeFields()
    const opus = resolveSettings(fields, { model: 'opus' })
    const sonnet = resolveSettings(fields, { model: 'sonnet' })

    expect(visibleSettingFields(fields, opus).map(field => field.key)).not.toContain('opusModel')
    expect(visibleSettingFields(fields, sonnet).map(field => field.key)).not.toContain('opusModel')
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
    const runner = testRunner({
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
    const end = (await ali.waitForEvent(e => e.kind === 'agent.end')) as Extract<SessionEvent, { kind: 'agent.end' }>
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
