import WebSocket from 'ws'
import { describe, expect, it } from 'vitest'
import { agentId } from '../src/shared/llm'
import type { ClientMessage, ServerMessage } from '../src/shared/protocol'
import type { StudioNode } from '../src/shared/studio'
import { startHost, TestUi, waitUntil } from './helpers/session'

describe('Studio', () => {
  it('creates, persists, synchronizes, favorites, duplicates, and deletes Studio files', async () => {
    const host = await startHost()
    const ali = await TestUi.connect(host.url, 'ali', host.code)
    const sam = await TestUi.connect(host.url, 'sam', host.code)

    ali.send({ type: 'studio.create', name: 'Product surface' })
    const created = await ali.waitFor(msg => msg.type === 'studio.created' && msg.byId === ali.selfId)
    if (created.type !== 'studio.created') throw new Error('expected studio.created')
    const studioId = created.studioId
    ali.send({ type: 'studio.open', studioId })
    sam.send({ type: 'studio.open', studioId })
    const opened = await ali.waitFor(msg => msg.type === 'studio.doc' && msg.doc.id === studioId)
    if (opened.type !== 'studio.doc') throw new Error('expected studio.doc')
    const pageId = opened.doc.pages[0].id
    const frame: StudioNode = { id: crypto.randomUUID(), type: 'frame', name: 'Dashboard', x: 80, y: 64, w: 960, h: 640, fill: '#ffffff', radius: 24 }

    ali.send({ type: 'studio.op', studioId, ops: [{ kind: 'upsert', nodes: [frame], pageId }, { kind: 'variable.set', name: 'accent', value: '#6d5dfc' }] })
    const synced = await sam.waitFor(msg => msg.type === 'studio.op' && msg.studioId === studioId)
    expect(synced.type === 'studio.op' && synced.ops).toHaveLength(2)
    await waitUntil(() => host.store.loadStudios().find(doc => doc.id === studioId)?.nodes[frame.id]?.name === 'Dashboard')
    expect(host.store.loadStudios().find(doc => doc.id === studioId)?.variables.accent).toBe('#6d5dfc')

    ali.send({ type: 'studio.presence', studioId, pageId, cursor: { x: 120, y: 240 }, selection: [frame.id] })
    const peers = await sam.waitFor(msg => msg.type === 'studio.presence' && msg.studioId === studioId && msg.peers.some(peer => peer.name === 'ali' && peer.cursor?.x === 120))
    expect(peers.type === 'studio.presence' && peers.peers.some(peer => peer.selection.includes(frame.id))).toBe(true)

    ali.send({ type: 'studio.rename', studioId, name: 'Launch dashboard' })
    ali.send({ type: 'studio.favorite', studioId, favorite: true })
    await sam.waitFor(msg => msg.type === 'studio.meta' && msg.studioId === studioId && msg.name === 'Launch dashboard' && msg.favorite)
    ali.send({ type: 'studio.duplicate', studioId })
    const copy = await ali.waitFor(msg => msg.type === 'studio.created' && msg.type === 'studio.created' && msg.studioId !== studioId && msg.byId === ali.selfId)
    expect(copy.type).toBe('studio.created')

    ali.send({ type: 'studio.delete', studioId })
    await sam.waitFor(msg => msg.type === 'studio.deleted' && msg.studioId === studioId)
    await waitUntil(() => !host.store.loadStudios().some(doc => doc.id === studioId))

    ali.close(); sam.close(); await host.close()
  })

  it('routes /studio to the selected agent and applies its generated canvas operations', async () => {
    const host = await startHost()
    const runner = await connectRunner(host.url, host.code)
    const ui = await TestUi.connect(host.url, 'ali', host.code)
    const codexId = agentId('workstation', 'codex')
    await waitUntil(() => host.session.snapshot().agents.some(agent => agent.id === codexId))

    ui.chat('@Codex /studio Design a modern analytics dashboard', [codexId])
    const created = await ui.waitFor(msg => msg.type === 'studio.created' && msg.byId === ui.selfId)
    if (created.type !== 'studio.created') throw new Error('expected studio.created')
    ui.send({ type: 'studio.open', studioId: created.studioId })
    const opened = await ui.waitFor(msg => msg.type === 'studio.doc' && msg.doc.id === created.studioId)
    if (opened.type !== 'studio.doc') throw new Error('expected studio.doc')

    const prompt = await runner.waitFor(msg => msg.type === 'prompt')
    if (prompt.type !== 'prompt') throw new Error('expected prompt')
    expect(prompt.text).toContain('a design agent working in')
    expect(prompt.text).toContain('Design a modern analytics dashboard')
    const nodeId = crypto.randomUUID()
    runner.send({
      type: 'agent.done',
      promptId: prompt.promptId,
      text: `I created the dashboard foundation.\n\n\`\`\`studio-ops\n[{"kind":"upsert","pageId":"${opened.doc.pages[0].id}","nodes":[{"id":"${nodeId}","type":"frame","name":"Analytics dashboard","x":80,"y":80,"w":1200,"h":760,"fill":"#111827","radius":24}]}]\n\`\`\``
    })
    const reply = await ui.waitFor(msg => msg.type === 'studio.chat' && msg.studioId === created.studioId && msg.entry.kind === 'agent')
    expect(reply.type === 'studio.chat' && reply.entry.opsApplied).toBe(1)
    await waitUntil(() => host.store.loadStudios().find(doc => doc.id === created.studioId)?.nodes[nodeId] !== undefined)
    const studioThread = host.session.snapshot().events.find(event => event.kind === 'thread.started' && event.studioId === created.studioId)
    expect(studioThread).toBeTruthy()

    runner.close(); ui.close(); await host.close()
  })

  it('accepts PDFs and text files for Studio agents while preserving image-only Chat behavior', async () => {
    const host = await startHost()
    const ui = await TestUi.connect(host.url, 'ali', host.code)
    ui.send({ type: 'studio.create', name: 'Files' })
    const created = await ui.waitFor(message => message.type === 'studio.created' && message.byId === ui.selfId)
    if (created.type !== 'studio.created') throw new Error('expected studio.created')
    ui.send({ type: 'studio.open', studioId: created.studioId })
    await ui.waitFor(message => message.type === 'studio.doc' && message.doc.id === created.studioId)
    ui.send({ type: 'studio.chat', studioId: created.studioId, text: 'Use these references', mentions: [], attachments: [
      { name: 'brief.pdf', mime: 'application/pdf', data: Buffer.from('%PDF-test').toString('base64') },
      { name: 'notes.md', mime: 'text/markdown', data: Buffer.from('# Notes').toString('base64') }
    ] })
    const chat = await ui.waitFor(message => message.type === 'studio.chat' && message.entry.kind === 'user')
    expect(chat.type === 'studio.chat' && chat.entry.attachments?.map(file => file.name)).toEqual(['brief.pdf', 'notes.md'])
    expect(host.session.saveAttachment('application/pdf', 'brief.pdf', Buffer.from('%PDF-test'))).toBeNull()
    expect(host.session.saveAttachment('application/x-executable', 'bad.exe', Buffer.from('no'))).toBeNull()
    ui.close()
    await host.close()
  })
})

class TestRunner {
  private messages: ServerMessage[] = []
  private waiters: Array<{ pred: (msg: ServerMessage) => boolean; resolve: (msg: ServerMessage) => void }> = []
  constructor(private ws: WebSocket) {
    ws.on('message', raw => {
      const message = JSON.parse(raw.toString()) as ServerMessage
      this.messages.push(message)
      this.waiters = this.waiters.filter(waiter => {
        if (!waiter.pred(message)) return true
        waiter.resolve(message); return false
      })
    })
  }
  waitFor(pred: (msg: ServerMessage) => boolean): Promise<ServerMessage> {
    const current = this.messages.find(pred)
    if (current) return Promise.resolve(current)
    return new Promise(resolve => this.waiters.push({ pred, resolve }))
  }
  send(message: ClientMessage): void { this.ws.send(JSON.stringify(message)) }
  close(): void { this.ws.close() }
}

function connectRunner(url: string, code: string): Promise<TestRunner> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const runner = new TestRunner(ws)
    ws.once('open', () => {
      ws.send(JSON.stringify({ type: 'hello', role: 'runner', name: 'workstation', code, llms: [{ instanceId: 'codex', provider: 'codex', label: 'Codex', fields: [], settings: {} }] }))
      resolve(runner)
    })
    ws.once('error', reject)
  })
}
