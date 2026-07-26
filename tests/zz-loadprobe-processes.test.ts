import os from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import { agentId } from '../src/shared/llm'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, tmpDir, waitUntil, type TestHost } from './helpers/session'

const hosts: TestHost[] = []
const runners: Runner[] = []
const uis: TestUi[] = []

afterEach(async () => {
  for (const ui of uis.splice(0)) ui.close()
  for (const r of runners.splice(0)) r.close()
  for (const h of hosts.splice(0)) await h.close().catch(() => {})
})

function ms(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e6
}

// Real subprocesses, one per agent, each in its own thread so nothing in the
// runner serializes them. This is the shape of "everyone hits go at once".
describe('load: real process concurrency', () => {
  it('finds where a single machine stops keeping up', async () => {
    const table: Array<Record<string, unknown>> = []
    const cpus = os.cpus().length
    for (const agents of [1, 2, 4, 8, 16, 24, 32]) {
      const host = await startHost(tmpDir('proc'))
      hosts.push(host)
      const ui = await TestUi.connect(host.url, 'boss', host.code)
      uis.push(ui)
      const runner = new Runner({
        name: 'rig',
        code: host.code,
        repoPath: host.repoPath,
        // A 60ms per line delay stands in for a model that streams for a while.
        providers: [makeFakeProvider({ FAKE_CLI_DELAY_MS: '60', FAKE_CLI_ACTIVITY: '1' })],
        agents: Array.from({ length: agents }, (_, i) => ({
          instanceId: `a${i}`,
          provider: 'fake',
          name: `A${i}`,
          settings: {}
        })),
        reconnectDelayMs: 100
      })
      runners.push(runner)
      runner.connect(host.url)
      await waitUntil(() => host.session.snapshot().agents.length === agents, 60000)

      const ids = Array.from({ length: agents }, (_, i) => agentId('rig', `a${i}`))
      const memBefore = process.memoryUsage().rss

      const start = process.hrtime.bigint()
      // A top-level message mints its own thread, so nothing queues here and
      // every one of these spawns a process.
      for (const id of ids) ui.chat(`go ${id}`, [id])
      await waitUntil(() => ui.events.filter(e => e.kind === 'agent.start').length >= agents, 120000)
      const allStartedMs = ms(start)
      await waitUntil(() => ui.events.filter(e => e.kind === 'agent.end').length >= agents, 180000)
      const allDoneMs = ms(start)

      const ends = ui.events.filter(e => e.kind === 'agent.end') as Array<{ ok?: boolean }>
      const failed = ends.filter(e => e.ok === false).length
      const memAfter = process.memoryUsage().rss

      table.push({
        agents,
        cpus,
        allStartedMs: +allStartedMs.toFixed(0),
        allDoneMs: +allDoneMs.toFixed(0),
        msPerAgent: +(allDoneMs / agents).toFixed(0),
        // A perfectly parallel run finishes in the time one agent takes.
        slowdownVsOne: table.length ? +(allDoneMs / (table[0].allDoneMs as number)).toFixed(2) : 1,
        failed,
        rssDeltaMB: +((memAfter - memBefore) / 1024 / 1024).toFixed(1)
      })
      ui.close()
      runner.close()
    }
    console.log('\n=== REAL PROCESSES ===\n' + JSON.stringify(table, null, 1))
    expect(table.length).toBe(7)
  }, 900000)
})

// Two agents named in one message land in one thread. The runner chains them,
// so the second waits for the first however long that takes.
describe('load: thread serialization', () => {
  it('shows many agents in one thread run one at a time', async () => {
    const host = await startHost(tmpDir('serial'))
    hosts.push(host)
    const ui = await TestUi.connect(host.url, 'boss', host.code)
    uis.push(ui)
    const agents = 6
    const runner = new Runner({
      name: 'rig',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider({ FAKE_CLI_DELAY_MS: '80' })],
      agents: Array.from({ length: agents }, (_, i) => ({
        instanceId: `a${i}`,
        provider: 'fake',
        name: `A${i}`,
        settings: {}
      })),
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await waitUntil(() => host.session.snapshot().agents.length === agents, 60000)
    const ids = Array.from({ length: agents }, (_, i) => agentId('rig', `a${i}`))

    const sameThread = process.hrtime.bigint()
    ui.chat('everyone go', ids, 'one-thread')
    await waitUntil(() => ui.events.filter(e => e.kind === 'agent.end').length >= agents, 180000)
    const sameMs = ms(sameThread)

    console.log(
      '\n=== THREAD SERIALIZATION ===\n' +
        JSON.stringify({ agents, sameThreadMs: +sameMs.toFixed(0), msPerAgent: +(sameMs / agents).toFixed(0) }, null, 1)
    )
    expect(sameMs).toBeGreaterThan(0)
  }, 300000)
})
