import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { startHost, TestUi, tmpDir, waitUntil, type TestHost } from './helpers/session'
import type { ClientMessage, RegisteredLlm, ServerMessage } from '../src/shared/protocol'

const hosts: TestHost[] = []
const sockets: WebSocket[] = []

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.close()
  for (const host of hosts.splice(0)) await host.close().catch(() => {})
})

async function host(): Promise<TestHost> {
  const h = await startHost(tmpDir('load'))
  hosts.push(h)
  return h
}

// A runner that registers N agents and answers every prompt instantly, so the
// measurement is of the host rather than of a CLI process.
class GhostRunner {
  private ws!: WebSocket
  prompts = 0
  onPrompt: ((promptId: string) => void) | null = null

  static async connect(url: string, name: string, code: string, agents: number): Promise<GhostRunner> {
    const r = new GhostRunner()
    const llms: RegisteredLlm[] = Array.from({ length: agents }, (_, i) => ({
      id: `${name}-a${i}`,
      instanceId: `a${i}`,
      provider: 'fake',
      label: `${name}-a${i}`,
      fields: [],
      settings: {}
    }))
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      r.ws = ws
      sockets.push(ws)
      const timer = setTimeout(() => reject(new Error('runner hello timed out')), 20000)
      ws.on('open', () => {
        const hello: ClientMessage = { type: 'hello', role: 'runner', name, code, llms }
        ws.send(JSON.stringify(hello))
      })
      ws.on('message', raw => {
        const msg = JSON.parse(raw.toString()) as ServerMessage
        if (msg.type === 'welcome') {
          clearTimeout(timer)
          resolve(r)
        }
        if (msg.type === 'prompt') {
          r.prompts++
          r.onPrompt?.(msg.promptId)
        }
      })
      ws.on('error', err => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  send(msg: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  step(promptId: string, id: string, text: string): void {
    this.send({ type: 'agent.step', promptId, step: { id, kind: 'text', text } as never })
  }

  done(promptId: string, text = 'ok'): void {
    this.send({ type: 'agent.done', promptId, text })
  }
}

function ms(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e6
}

// Measures how long the event loop is blocked, which is what a user feels as
// the app going unresponsive.
class LoopLag {
  private samples: number[] = []
  private timer: NodeJS.Timeout | null = null
  private last = 0
  private period = 10

  start(): void {
    this.last = Date.now()
    this.timer = setInterval(() => {
      const now = Date.now()
      this.samples.push(Math.max(0, now - this.last - this.period))
      this.last = now
    }, this.period)
  }

  stop(): { max: number; p95: number; mean: number } {
    if (this.timer) clearInterval(this.timer)
    const s = [...this.samples].sort((a, b) => a - b)
    if (s.length === 0) return { max: 0, p95: 0, mean: 0 }
    return {
      max: s[s.length - 1],
      p95: s[Math.floor(s.length * 0.95)] ?? s[s.length - 1],
      mean: s.reduce((a, b) => a + b, 0) / s.length
    }
  }
}

describe('load: member fan-out', () => {
  it('measures broadcast cost as clients scale', async () => {
    const table: Array<Record<string, unknown>> = []
    for (const clients of [1, 5, 10, 20, 40]) {
      const h = await host()
      const uis: TestUi[] = []
      for (let i = 0; i < clients; i++) uis.push(await TestUi.connect(h.url, `p${i}`, h.code))
      const runner = await GhostRunner.connect(h.url, 'rig', h.code, 1)
      await waitUntil(() => h.session.snapshot().agents.length === 1)
      const agentId = h.session.snapshot().agents[0].id

      let promptId = ''
      runner.onPrompt = id => (promptId = id)
      uis[0].chat('go', [agentId])
      await waitUntil(() => promptId !== '')

      const BURST = 300
      const lag = new LoopLag()
      lag.start()
      const start = process.hrtime.bigint()
      for (let i = 0; i < BURST; i++) runner.step(promptId, `s${i}`, `line ${i} ${'x'.repeat(200)}`)
      const enqueue = ms(start)
      const last = uis[uis.length - 1]
      await waitUntil(() => last.steps.length >= BURST, 25000)
      const delivered = ms(start)
      const lagOut = lag.stop()

      table.push({
        clients,
        steps: BURST,
        msgs: BURST * clients,
        enqueueMs: +enqueue.toFixed(1),
        deliveredMs: +delivered.toFixed(1),
        msPerMsg: +(delivered / (BURST * clients)).toFixed(3),
        lagMax: lagOut.max,
        lagP95: lagOut.p95
      })
      for (const ui of uis) ui.close()
    }
    console.log('\n=== FAN-OUT ===\n' + JSON.stringify(table, null, 1))
    expect(table.length).toBe(5)
  }, 180000)
})

describe('load: event log growth', () => {
  it('measures snapshot and reload cost as history grows', async () => {
    const table: Array<Record<string, unknown>> = []
    const h = await host()
    const ui = await TestUi.connect(h.url, 'writer', h.code)
    let written = 0
    for (const target of [500, 2000, 10000, 30000]) {
      const lag = new LoopLag()
      lag.start()
      const writeStart = process.hrtime.bigint()
      for (; written < target; written++) ui.chat(`message number ${written} ${'y'.repeat(120)}`)
      await waitUntil(() => h.session.snapshot().events.length > 0 && countEvents(h) >= target, 60000)
      const writeMs = ms(writeStart)
      const lagOut = lag.stop()

      const snapStart = process.hrtime.bigint()
      const snap = h.session.snapshot()
      const snapMs = ms(snapStart)
      const wire = JSON.stringify({ type: 'welcome', selfId: 'x', snapshot: snap })

      const joinStart = process.hrtime.bigint()
      const joiner = await TestUi.connect(h.url, `j${target}`, h.code)
      const joinMs = ms(joinStart)
      joiner.close()

      const loadStart = process.hrtime.bigint()
      const loaded = h.store.loadEvents()
      const loadMs = ms(loadStart)

      table.push({
        events: target,
        writeMs: +writeMs.toFixed(0),
        writeLagMax: lagOut.max,
        snapshotEvents: snap.events.length,
        snapshotMs: +snapMs.toFixed(1),
        welcomeKB: +(wire.length / 1024).toFixed(1),
        joinMs: +joinMs.toFixed(0),
        diskEvents: loaded.length,
        reloadMs: +loadMs.toFixed(0)
      })
    }
    console.log('\n=== EVENT LOG ===\n' + JSON.stringify(table, null, 1))
    expect(table.length).toBe(4)
  }, 300000)
})

function countEvents(h: TestHost): number {
  return (h.session as unknown as { events: unknown[] }).events.length
}

describe('load: agent count', () => {
  it('measures registration and simultaneous dispatch as agents scale', async () => {
    const table: Array<Record<string, unknown>> = []
    for (const agents of [4, 16, 32, 64, 128]) {
      const h = await host()
      const ui = await TestUi.connect(h.url, 'boss', h.code)
      const regStart = process.hrtime.bigint()
      const runner = await GhostRunner.connect(h.url, 'rig', h.code, agents)
      await waitUntil(() => h.session.snapshot().agents.length === agents, 60000)
      const regMs = ms(regStart)

      const ids = h.session.snapshot().agents.map(a => a.id)
      const seen: string[] = []
      runner.onPrompt = id => seen.push(id)

      const lag = new LoopLag()
      lag.start()
      const fireStart = process.hrtime.bigint()
      // Every agent, one thread each, all at once. This is the shape that has
      // no cap anywhere on the runner.
      for (const id of ids) ui.chat(`work ${id}`, [id])
      await waitUntil(() => seen.length >= agents, 60000)
      const dispatchMs = ms(fireStart)

      for (const id of seen) {
        for (let i = 0; i < 10; i++) runner.step(id, `s${i}`, `step ${i}`)
        runner.done(id)
      }
      await waitUntil(() => h.session.snapshot().agents.every(a => a.status !== 'running'), 60000)
      const settleMs = ms(fireStart)
      const lagOut = lag.stop()

      const snap = h.session.snapshot()
      table.push({
        agents,
        registerMs: +regMs.toFixed(0),
        dispatchMs: +dispatchMs.toFixed(0),
        settleMs: +settleMs.toFixed(0),
        snapshotKB: +(JSON.stringify(snap).length / 1024).toFixed(1),
        lagMax: lagOut.max,
        lagP95: lagOut.p95
      })
      ui.close()
    }
    console.log('\n=== AGENT COUNT ===\n' + JSON.stringify(table, null, 1))
    expect(table.length).toBe(5)
  }, 300000)
})
