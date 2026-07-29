import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import type { ServerMessage } from '../src/shared/protocol'
import { boardOf, isTicketEvent, type TicketEvent } from '../src/shared/tickets'
import type { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { testRunner } from './helpers/runner'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Start = Extract<SessionEvent, { kind: 'agent.start' }>
type Added = Extract<SessionEvent, { kind: 'ticket.added' }>
type Moved = Extract<SessionEvent, { kind: 'ticket.moved' }>
type Decided = Extract<SessionEvent, { kind: 'ticket.decided' }>
type Asked = Extract<SessionEvent, { kind: 'ticket.asked' }>

const fake = agentId('jamel', 'fake')

describe('the board over http', () => {
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

  async function openBoard(delayMs = 1500): Promise<{ ui: TestUi; run: Start }> {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(delayMs)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === fake)
    ui.chat('break this down and keep the board', [fake], undefined, ['tickets'])
    await ui.waitForEvent(e => e.kind === 'thread.started')
    return { ui, run: (await ui.waitForEvent(e => e.kind === 'agent.start')) as Start }
  }

  it('puts the work up, hands back the ids, and folds the calls into a board', async () => {
    const { ui, run } = await openBoard()

    const put = await post('/tickets', {
      promptId: run.promptId,
      tickets: ['Read how the sync loop commits', 'Segment the chat log', 'Cover it with a test']
    })
    expect(put.status).toBe(200)
    expect(put.body.ids).toEqual(['1', '2', '3'])

    const first = (await ui.waitForEvent(e => e.kind === 'ticket.added')) as Added
    expect(first.threadId).toBe(run.threadId)
    expect(first.title).toBe('Read how the sync loop commits')

    // A title already up is passed over, and the ids carry on from what the
    // thread holds rather than starting again.
    const again = await post('/tickets', {
      promptId: run.promptId,
      tickets: ['segment the chat log', 'Push it']
    })
    expect(again.body.ids).toEqual(['4'])

    expect((await post(`/tickets/2`, { promptId: run.promptId, column: 'doing' })).body).toEqual({ ok: true })
    const moved = (await ui.waitForEvent(e => e.kind === 'ticket.moved')) as Moved
    expect(moved.ticketId).toBe('2')
    expect(moved.column).toBe('doing')

    await post(`/tickets/2`, {
      promptId: run.promptId,
      column: 'review',
      note: 'The log seals a segment at a megabyte'
    })
    await ui.waitForEvent(e => e.kind === 'ticket.moved' && e.column === 'review')

    expect((await post(`/tickets/2/decision`, { promptId: run.promptId, text: 'Kept the local copy' })).status).toBe(200)
    const decided = (await ui.waitForEvent(e => e.kind === 'ticket.decided')) as Decided
    expect(decided.text).toBe('Kept the local copy')

    const asked = await post('/tickets/question', {
      promptId: run.promptId,
      ask: 'Key the cache on the commit or on the path?',
      assumed: 'the commit',
      options: ['the commit', 'the path']
    })
    expect(asked.body).toEqual({ ok: true })
    const question = (await ui.waitForEvent(e => e.kind === 'ticket.asked')) as Asked
    expect(question.askId).toBeTruthy()
    expect(question.options).toEqual(['the commit', 'the path'])

    const board = boardOf([], ui.events.filter(e => isTicketEvent(e.kind)) as TicketEvent[])
    expect(board.tickets.map(ticket => ticket.title)).toEqual([
      'Read how the sync loop commits',
      'Segment the chat log',
      'Cover it with a test',
      'Push it'
    ])
    expect(board.tickets[1].column).toBe('review')
    expect(board.tickets[1].review).toBe('The log seals a segment at a megabyte')
    expect(board.tickets[1].decisions).toEqual(['Kept the local copy'])
    expect(board.questions[0].ask).toBe('Key the cache on the commit or on the path?')
  })

  it('refuses a promptId that is not a run going here', async () => {
    const { ui, run } = await openBoard(20)

    const strange = await post('/tickets', { promptId: '1e2d3c4b-0000-0000-0000-000000000000', tickets: ['Anything'] })
    expect(strange.status).toBe(400)
    expect(strange.body.error).toContain('not a run')

    // A run that has ended is no more a board than one that never existed.
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === run.promptId)
    const late = await post('/tickets', { promptId: run.promptId, tickets: ['Too late'] })
    expect(late.status).toBe(400)
    const asked = await post('/tickets/question', { promptId: run.promptId, ask: 'Anybody there?' })
    expect(asked.status).toBe(400)
    expect(ui.events.some(e => isTicketEvent(e.kind))).toBe(false)
  })

  it('refuses a ticket the thread never put up and a column there is no such thing as', async () => {
    const { run } = await openBoard()
    await post('/tickets', { promptId: run.promptId, tickets: ['Read how the sync loop commits'] })

    const missing = await post('/tickets/9', { promptId: run.promptId, column: 'doing' })
    expect(missing.status).toBe(404)
    expect(missing.body.error).toContain('No ticket')

    const sideways = await post('/tickets/1', { promptId: run.promptId, column: 'sideways' })
    expect(sideways.status).toBe(404)
    expect(sideways.body.error).toContain('todo, doing, review and done')

    expect((await post('/tickets/1', { promptId: run.promptId, column: 'done' })).status).toBe(200)
  })

  it('keeps the board out of the chat somebody arriving is handed', async () => {
    const { ui, run } = await openBoard()
    await post('/tickets', { promptId: run.promptId, tickets: ['Read how the sync loop commits'] })
    await post('/tickets/1', { promptId: run.promptId, column: 'doing' })
    await ui.waitForEvent(e => e.kind === 'ticket.moved')

    const late = await TestUi.connect(host.url, 'robin', host.code)
    uis.push(late)
    const welcome = late.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
    const kinds = welcome.snapshot.events.map(event => event.kind)
    expect(kinds).toContain('thread.started')
    expect(kinds.some(isTicketEvent)).toBe(false)
  })
})
