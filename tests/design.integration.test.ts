import { describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import { Store } from '../src/server/store'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import type { ServerMessage } from '../src/shared/protocol'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, tmpDir, waitUntil } from './helpers/session'

const PAGE = { id: 'page:page', typeName: 'page', name: 'Page 1', index: 'a1', meta: {} }

function initBoard(ui: TestUi, boardId: string): void {
  ui.send({ type: 'design.init', boardId, document: { store: { 'page:page': PAGE }, schema: { sequences: {} } } })
}

describe('design boards', () => {
  it('creates, renames and deletes boards for everyone', async () => {
    const repoPath = tmpDir('design-crud')
    const host = await startHost(repoPath)
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    const watcher = await TestUi.connect(host.url, 'ana', host.code)

    ui.send({ type: 'design.create', boardId: 'hero-1abc', name: 'Hero page' })
    await watcher.waitFor(
      m => m.type === 'design.boards' && m.boards.some(b => b.id === 'hero-1abc' && b.name === 'Hero page')
    )
    const store = new Store(repoPath)
    await waitUntil(() => store.loadDesigns()['hero-1abc']?.name === 'Hero page')
    expect(host.session.snapshot().boards).toEqual([{ id: 'hero-1abc', name: 'Hero page' }])

    ui.send({ type: 'design.rename', boardId: 'hero-1abc', name: 'Landing' })
    await watcher.waitFor(m => m.type === 'design.boards' && m.boards.some(b => b.name === 'Landing'))
    await waitUntil(() => store.loadDesigns()['hero-1abc']?.name === 'Landing')

    ui.send({ type: 'design.delete', boardId: 'hero-1abc' })
    await watcher.waitFor(m => m.type === 'design.boards' && m.boards.length === 0)
    await waitUntil(() => store.loadDesigns()['hero-1abc'] === undefined)

    ui.close()
    watcher.close()
    await host.close()
  })

  it('serves a snapshot, takes the first init, and relays changes to everyone else', async () => {
    const repoPath = tmpDir('design-sync')
    const host = await startHost(repoPath)
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    const watcher = await TestUi.connect(host.url, 'ana', host.code)

    ui.send({ type: 'design.create', boardId: 'flow-1abc', name: 'Flow' })
    ui.send({ type: 'design.open', boardId: 'flow-1abc' })
    const empty = await ui.waitFor(m => m.type === 'design.snapshot' && m.boardId === 'flow-1abc')
    expect((empty as Extract<ServerMessage, { type: 'design.snapshot' }>).document).toBeNull()

    initBoard(ui, 'flow-1abc')
    const filled = await watcher.waitFor(
      m => m.type === 'design.snapshot' && m.boardId === 'flow-1abc' && m.document !== null
    )
    expect(
      ((filled as Extract<ServerMessage, { type: 'design.snapshot' }>).document?.store ?? {})['page:page']
    ).toBeTruthy()

    const shape = { id: 'shape:s1', typeName: 'shape', type: 'geo', x: 10, y: 20, parentId: 'page:page' }
    ui.send({ type: 'design.apply', boardId: 'flow-1abc', put: [shape], remove: [] })
    const changes = await watcher.waitFor(m => m.type === 'design.changes' && m.boardId === 'flow-1abc')
    expect((changes as Extract<ServerMessage, { type: 'design.changes' }>).put).toEqual([shape])
    expect(ui.messages.some(m => m.type === 'design.changes')).toBe(false)

    const store = new Store(repoPath)
    await waitUntil(() => store.loadDesigns()['flow-1abc']?.document?.store['shape:s1'] !== undefined)

    ui.send({ type: 'design.apply', boardId: 'flow-1abc', put: [], remove: ['shape:s1'] })
    await watcher.waitFor(m => m.type === 'design.changes' && (m.remove ?? []).includes('shape:s1'))
    await waitUntil(() => store.loadDesigns()['flow-1abc']?.document?.store['shape:s1'] === undefined)

    const late = await TestUi.connect(host.url, 'kim', host.code)
    late.send({ type: 'design.open', boardId: 'flow-1abc' })
    const snapshot = await late.waitFor(m => m.type === 'design.snapshot' && m.document !== null)
    expect(
      ((snapshot as Extract<ServerMessage, { type: 'design.snapshot' }>).document?.store ?? {})['shape:s1']
    ).toBeUndefined()

    ui.close()
    watcher.close()
    late.close()
    await host.close()
  })

  it('keeps cursors live and out of the event log', async () => {
    const repoPath = tmpDir('design-presence')
    const host = await startHost(repoPath)
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    const watcher = await TestUi.connect(host.url, 'ana', host.code)

    ui.send({ type: 'design.create', boardId: 'wire-1abc', name: 'Wireframe' })
    initBoard(ui, 'wire-1abc')
    const store = new Store(repoPath)
    const eventsBefore = store.loadEvents().length

    ui.send({
      type: 'design.presence',
      boardId: 'wire-1abc',
      cursor: { x: 5, y: 6 },
      selection: ['shape:s1'],
      pageId: 'page:page'
    })
    const seen = await watcher.waitFor(m => m.type === 'design.presence' && m.boardId === 'wire-1abc')
    const presence = (seen as Extract<ServerMessage, { type: 'design.presence' }>).presence
    expect(presence.name).toBe('sam')
    expect(presence.kind).toBe('human')
    expect(presence.cursor).toEqual({ x: 5, y: 6 })
    expect(ui.messages.some(m => m.type === 'design.presence')).toBe(false)

    const open = await TestUi.connect(host.url, 'kim', host.code)
    open.send({ type: 'design.open', boardId: 'wire-1abc' })
    const snap = await open.waitFor(m => m.type === 'design.snapshot')
    expect((snap as Extract<ServerMessage, { type: 'design.snapshot' }>).presence.some(p => p.name === 'sam')).toBe(
      true
    )

    ui.close()
    await watcher.waitFor(
      m => m.type === 'design.presence' && m.presence.userId === presence.userId && m.presence.pageId === null
    )
    await waitUntil(() => store.loadEvents().length >= eventsBefore)
    expect(store.loadEvents().length).toBe(eventsBefore)

    watcher.close()
    open.close()
    await host.close()
  })

  it('starts board threads and hands the agent the board API', async () => {
    const host = await startHost(tmpDir('design-thread'))
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    const runner = new Runner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [{ instanceId: 'fake', provider: 'fake', name: 'Fake', settings: {} }],
      reconnectDelayMs: 100
    })
    runner.connect(host.url)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake')

    ui.send({ type: 'design.create', boardId: 'shop-1abc', name: 'Shop' })
    initBoard(ui, 'shop-1abc')
    const id = agentId('jamel', 'fake')
    ui.send({ type: 'chat.send', text: 'sketch a checkout @Fake', mentions: [id], boardId: 'shop-1abc' })

    const started = await ui.waitForEvent(e => e.kind === 'thread.started')
    expect((started as Extract<SessionEvent, { kind: 'thread.started' }>).boardId).toBe('shop-1abc')

    const end = await ui.waitForEvent(e => e.kind === 'agent.end')
    const reply = (end as Extract<SessionEvent, { kind: 'agent.end' }>).text ?? ''
    expect(reply).toContain('design board "Shop"')
    expect(reply).toContain('/design/shop-1abc')
    expect(reply).toContain('http://')
    expect(reply).toContain(`"${id}"`)

    ui.close()
    runner.close()
    await host.close()
  })
})
