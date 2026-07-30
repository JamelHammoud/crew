import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildThread, eventsOfThread } from '../src/renderer/src/components/thread'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import type { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { testRunner } from './helpers/runner'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Start = Extract<SessionEvent, { kind: 'agent.start' }>
type Shown = Extract<SessionEvent, { kind: 'page.shown' }>

const fake = agentId('jamel', 'fake')

describe('a page an agent shows', () => {
  let host: TestHost
  let runners: Runner[] = []
  let uis: TestUi[] = []
  let base = ''

  beforeEach(async () => {
    host = await startHost()
    base = host.url.replace('ws://', 'http://').replace('/ws', '')
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.close()
    uis = []
    runners = []
    await host.close()
  })

  // A run has to still be going for its promptId to be worth anything, so the
  // CLI is slowed down to hold one open while the calls are made.
  async function connectRunner(delayMs: number): Promise<void> {
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider({ FAKE_CLI_DELAY_MS: String(delayMs) })],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await new Promise<void>(resolve => {
      runner.onStatus = status => {
        if (status === 'online') resolve()
      }
    })
  }

  const post = (path: string, body: unknown): Promise<{ status: number; body: any }> =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(async res => ({ status: res.status, body: await res.json() }))

  async function startRun(delayMs = 1500): Promise<{ ui: TestUi; run: Start }> {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(delayMs)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === fake)
    ui.chat('build me a page', [fake])
    await ui.waitForEvent(e => e.kind === 'thread.started')
    return { ui, run: (await ui.waitForEvent(e => e.kind === 'agent.start')) as Start }
  }

  it('puts a file on the thread as a page, under the agent that showed it', async () => {
    const { ui, run } = await startRun()

    const shown = await post('/page', {
      promptId: run.promptId,
      url: '/Users/sam/site/index.html',
      title: 'The signup page'
    })
    expect(shown.status).toBe(200)
    expect(shown.body).toEqual({ ok: true })

    const event = (await ui.waitForEvent(e => e.kind === 'page.shown')) as Shown
    expect(event.threadId).toBe(run.threadId)
    expect(event.url).toBe('file:///Users/sam/site/index.html')
    expect(event.title).toBe('The signup page')
    expect(event.agentId).toBe(fake)

    // The row is the way back to it, so it reads in the thread it was shown in.
    const items = buildThread(eventsOfThread(ui.events, event.threadId), {}, 'sam')
    const row = items.find(item => item.kind === 'page')
    expect(row?.page).toEqual({ url: 'file:///Users/sam/site/index.html', title: 'The signup page' })
  })

  it('takes a server on this machine and names a page the agent said nothing about', async () => {
    const { ui, run } = await startRun()

    expect((await post('/page', { promptId: run.promptId, url: 'localhost:5173' })).status).toBe(200)
    const event = (await ui.waitForEvent(e => e.kind === 'page.shown')) as Shown
    expect(event.url).toBe('http://localhost:5173')
    expect(event.title).toBe('localhost:5173')
  })

  it('refuses anything that is not a page, and says what to write instead', async () => {
    const { ui, run } = await startRun()

    for (const url of ['javascript:alert(1)', 'data:text/html,<b>hi</b>', 'index.html', '', 'the signup page']) {
      const refused = await post('/page', { promptId: run.promptId, url })
      expect(refused.status).toBe(400)
      expect(refused.body.error).toContain('localhost')
    }
    expect(ui.events.some(e => e.kind === 'page.shown')).toBe(false)
  })

  it('refuses a promptId that is not a run going here', async () => {
    const { ui, run } = await startRun(20)

    const strange = await post('/page', {
      promptId: '1e2d3c4b-0000-0000-0000-000000000000',
      url: 'https://example.com'
    })
    expect(strange.status).toBe(400)
    expect(strange.body.error).toContain('not a run')

    // A run that has ended has nothing to put on anybody's screen.
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === run.promptId)
    const late = await post('/page', { promptId: run.promptId, url: 'https://example.com' })
    expect(late.status).toBe(400)
    expect(ui.events.some(e => e.kind === 'page.shown')).toBe(false)
  })
})
