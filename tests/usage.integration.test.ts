import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agentId, type AgentUsage } from '../src/shared/llm'
import type { ServerMessage } from '../src/shared/protocol'
import { Runner } from '../src/runner'
import type { Provider } from '../src/runner/providers/types'
import { claudeWindowsFrom, codexWindowsFrom } from '../src/runner/providers/usage'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

const sampleUsage = (): AgentUsage => ({
  provider: 'fake',
  fetchedAt: Date.now(),
  accountId: 'acct-1',
  accountLabel: 'someone@example.com',
  plan: 'max',
  windows: [
    { key: 'session', label: '5-hour limit', percent: 63, severity: 'normal', resetsAt: Date.now() + 3600_000, active: true },
    { key: 'weekly_all', label: 'Weekly (all models)', percent: 11, severity: 'normal' }
  ]
})

function makeUsageProvider(usage: AgentUsage): Provider {
  return { ...makeFakeProvider(), usage: async () => usage }
}

describe('usage limits', () => {
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

  async function connectRunner(name: string, provider: Provider) {
    const runner = new Runner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers: [provider],
      reconnectDelayMs: 100,
      usagePollMs: 100
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

  it('reports an agent usage snapshot to every ui', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const usage = sampleUsage()
    await connectRunner('jamel', makeUsageProvider(usage))

    const msg = (await ui.waitFor(m => m.type === 'agent.usage')) as Extract<
      ServerMessage,
      { type: 'agent.usage' }
    >
    expect(msg.agentId).toBe(agentId('jamel', 'fake'))
    expect(msg.usage.accountId).toBe('acct-1')
    expect(msg.usage.windows.map(w => w.label)).toEqual(['5-hour limit', 'Weekly (all models)'])
    expect(msg.usage.windows[0].percent).toBe(63)
  })

  it('includes the last usage in the snapshot for late joiners', async () => {
    const first = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(first)
    await connectRunner('jamel', makeUsageProvider(sampleUsage()))
    await first.waitFor(m => m.type === 'agent.usage')

    const late = await TestUi.connect(host.url, 'riley', host.code)
    uis.push(late)
    const welcome = (await late.waitFor(m => m.type === 'welcome')) as Extract<ServerMessage, { type: 'welcome' }>
    const agent = welcome.snapshot.agents.find(a => a.id === agentId('jamel', 'fake'))
    expect(agent?.usage?.windows[0].percent).toBe(63)
  })

  it('keeps polling so newer numbers replace older ones', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const usage = sampleUsage()
    await connectRunner('jamel', {
      ...makeFakeProvider(),
      usage: async () => ({ ...usage, fetchedAt: Date.now() })
    })

    const first = (await ui.waitFor(m => m.type === 'agent.usage')) as Extract<ServerMessage, { type: 'agent.usage' }>
    const second = (await ui.waitFor(
      m => m.type === 'agent.usage' && m.usage.fetchedAt > first.usage.fetchedAt
    )) as Extract<ServerMessage, { type: 'agent.usage' }>
    expect(second.usage.fetchedAt).toBeGreaterThan(first.usage.fetchedAt)
  })
})

describe('claude usage parsing', () => {
  it('reads the limits array with per-model weekly scopes', () => {
    const windows = claudeWindowsFrom({
      limits: [
        { kind: 'session', group: 'session', percent: 63, severity: 'normal', resets_at: '2026-07-20T21:59:59Z', is_active: true },
        { kind: 'weekly_all', group: 'weekly', percent: 11, severity: 'normal', resets_at: '2026-07-24T11:59:59Z', is_active: false },
        {
          kind: 'weekly_scoped',
          group: 'weekly',
          percent: 21,
          severity: 'normal',
          resets_at: '2026-07-24T11:59:59Z',
          scope: { model: { id: null, display_name: 'Fable' }, surface: null }
        }
      ]
    })
    expect(windows.map(w => w.label)).toEqual(['5-hour limit', 'Weekly (all models)', 'Weekly (Fable)'])
    expect(windows[0].percent).toBe(63)
    expect(windows[0].active).toBe(true)
    expect(windows[2].percent).toBe(21)
    expect(windows[1].resetsAt).toBe(Date.parse('2026-07-24T11:59:59Z'))
  })

  it('falls back to the flat five_hour and seven_day fields', () => {
    const windows = claudeWindowsFrom({
      five_hour: { utilization: 72, resets_at: '2026-07-20T21:59:59Z' },
      seven_day: { utilization: 40, resets_at: '2026-07-24T11:59:59Z' }
    })
    expect(windows.map(w => w.label)).toEqual(['5-hour limit', 'Weekly (all models)'])
    expect(windows[0].percent).toBe(72)
  })

  it('ignores malformed entries and clamps percents', () => {
    const windows = claudeWindowsFrom({
      limits: [
        { kind: 'session', percent: 130 },
        { kind: 'weekly_all', percent: 'lots' },
        { percent: 5 }
      ]
    })
    expect(windows).toHaveLength(1)
    expect(windows[0].percent).toBe(100)
  })
})

describe('codex usage parsing', () => {
  it('labels primary and secondary windows by their duration', () => {
    const at = Date.parse('2026-07-20T12:00:00Z')
    const windows = codexWindowsFrom(
      {
        primary: { used_percent: 45.2, window_minutes: 300, resets_in_seconds: 1200 },
        secondary: { used_percent: 12, window_minutes: 10080, resets_in_seconds: 86400 }
      },
      at
    )
    expect(windows.map(w => w.label)).toEqual(['5-hour limit', 'Weekly limit'])
    expect(windows[0].percent).toBeCloseTo(45.2)
    expect(windows[0].resetsAt).toBe(at + 1200_000)
    expect(windows[1].resetsAt).toBe(at + 86400_000)
  })

  it('handles missing windows without inventing data', () => {
    expect(codexWindowsFrom({}, Date.now())).toEqual([])
    expect(codexWindowsFrom({ primary: { used_percent: 'high' } }, Date.now())).toEqual([])
  })
})
