import { createTLSchema } from '@tldraw/tlschema'
import { describe, expect, it } from 'vitest'
import { applyDesignOps } from '../src/server/designops'
import type { DesignDocument, DesignOp, DesignOpResult } from '../src/shared/design'
import type { ServerMessage } from '../src/shared/protocol'
import { startHost, TestUi, tmpDir } from './helpers/session'

const PAGE = { id: 'page:page', typeName: 'page', name: 'Page 1', index: 'a1', meta: {} }

function freshDocument(): DesignDocument {
  return { store: { 'page:page': { ...PAGE } }, schema: null }
}

describe('design ops', () => {
  it('produces records the real tldraw schema accepts', () => {
    const schema = createTLSchema()
    const document = freshDocument()
    const ops: DesignOp[] = [
      { op: 'create', kind: 'rectangle', x: 0, y: 0, w: 240, h: 120, text: 'Box', color: 'blue', fill: 'semi' },
      { op: 'create', kind: 'ellipse', x: 300, y: 0 },
      { op: 'create', kind: 'triangle', x: 0, y: 200, color: 'red', fill: 'solid' },
      { op: 'create', kind: 'diamond', x: 300, y: 200 },
      { op: 'create', kind: 'star', x: 600, y: 0 },
      { op: 'create', kind: 'cloud', x: 600, y: 200 },
      { op: 'create', kind: 'hexagon', x: 900, y: 0 },
      { op: 'create', kind: 'oval', x: 900, y: 200 },
      { op: 'create', kind: 'x-box', x: 1200, y: 0 },
      { op: 'create', kind: 'check-box', x: 1200, y: 200 },
      { op: 'create', kind: 'text', x: 0, y: -100, text: 'Heading\nSecond line' },
      { op: 'create', kind: 'text', x: 0, y: -200, w: 300, text: 'Fixed width' },
      { op: 'create', kind: 'note', x: 1500, y: 0, text: 'Sticky', color: 'yellow' },
      { op: 'create', kind: 'frame', x: -50, y: -50, w: 800, h: 600, name: 'Hero' },
      { op: 'create', kind: 'arrow', x: 100, y: 400, endX: 400, endY: 450, color: 'grey' },
      { op: 'create', kind: 'line', x: 100, y: 500, endX: 400, endY: 500 }
    ]
    const applied = applyDesignOps(document, ops)
    expect(applied.results.map(r => r.error ?? null)).toEqual(ops.map(() => null))
    expect(applied.put.length).toBe(ops.length)
    for (const record of applied.put) {
      expect(() => schema.types.shape.validate(record)).not.toThrow()
    }
  })

  it('updates, reparents into frames, and cascades deletes', () => {
    const schema = createTLSchema()
    const document = freshDocument()
    const [frame] = applyDesignOps(document, [
      { op: 'create', kind: 'frame', x: 0, y: 0, w: 400, h: 300, name: 'Card' }
    ]).results
    const [child] = applyDesignOps(document, [
      { op: 'create', kind: 'rectangle', x: 20, y: 20, parent: frame.id, text: 'Inside' }
    ]).results
    const childRecord = document.store[child.id!] as { parentId: string }
    expect(childRecord.parentId).toBe(frame.id)

    const updated = applyDesignOps(document, [
      { op: 'update', id: child.id!, x: 40, w: 200, text: 'Renamed', color: 'green', fill: 'pattern' }
    ])
    expect(updated.results[0].id).toBe(child.id)
    expect(() => schema.types.shape.validate(document.store[child.id!])).not.toThrow()

    const removed = applyDesignOps(document, [{ op: 'delete', id: frame.id! }])
    expect(removed.results[0].id).toBe(frame.id)
    expect(removed.remove.sort()).toEqual([frame.id, child.id].sort())
    expect(document.store[child.id!]).toBeUndefined()

    const missing = applyDesignOps(document, [{ op: 'update', id: 'shape:nope', x: 0 }])
    expect(missing.results[0].error).toContain('shape:nope')
  })
})

describe('design HTTP API', () => {
  it('reads and edits a board over HTTP while everyone watches', async () => {
    const host = await startHost(tmpDir('design-http'))
    const base = `http://127.0.0.1:${host.server.port()}`
    const ui = await TestUi.connect(host.url, 'sam', host.code)

    ui.send({ type: 'design.create', boardId: 'app-1abc', name: 'App' })
    ui.send({
      type: 'design.init',
      boardId: 'app-1abc',
      document: { store: { 'page:page': { ...PAGE } }, schema: null }
    })
    await ui.waitFor(m => m.type === 'design.boards')

    const post = await fetch(`${base}/design/app-1abc/ops`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agent: 'jamel/fake',
        ops: [
          { op: 'create', kind: 'rectangle', x: 0, y: 0, w: 200, h: 100, text: 'Sign in', color: 'blue' },
          { op: 'create', kind: 'note', x: 300, y: 0, text: 'Use the brand color' },
          { op: 'point', x: 50, y: 50 }
        ]
      })
    })
    expect(post.status).toBe(200)
    const { results } = (await post.json()) as { results: DesignOpResult[] }
    expect(results).toHaveLength(3)
    expect(results[0].id).toMatch(/^shape:/)
    expect(results[1].id).toMatch(/^shape:/)
    expect(results[2].error).toBeUndefined()

    const changes = await ui.waitFor(m => m.type === 'design.changes' && m.boardId === 'app-1abc')
    expect((changes as Extract<ServerMessage, { type: 'design.changes' }>).put).toHaveLength(2)
    const presence = await ui.waitFor(m => m.type === 'design.presence' && m.presence.kind === 'agent')
    const agent = (presence as Extract<ServerMessage, { type: 'design.presence' }>).presence
    expect(agent.userId).toBe('jamel/fake')
    expect(agent.cursor).toBeTruthy()

    const read = await fetch(`${base}/design/app-1abc`)
    expect(read.status).toBe(200)
    const summary = (await read.json()) as { name: string; shapes: Array<{ kind: string; text?: string }> }
    expect(summary.name).toBe('App')
    expect(summary.shapes.some(s => s.kind === 'rectangle' && s.text === 'Sign in')).toBe(true)
    expect(summary.shapes.some(s => s.kind === 'note' && s.text === 'Use the brand color')).toBe(true)

    const bad = await fetch(`${base}/design/app-1abc/ops`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent: 'jamel/fake', ops: [{ op: 'update', id: 'shape:nope', x: 1 }] })
    })
    const badResults = ((await bad.json()) as { results: DesignOpResult[] }).results
    expect(badResults[0].error).toContain('shape:nope')

    expect((await fetch(`${base}/design/none-0000`)).status).toBe(404)
    expect((await fetch(`${base}/design/none-0000/ops`, { method: 'POST', body: '{"ops":[{}]}' })).status).toBe(404)
    expect((await fetch(`${base}/design/app-1abc/ops`, { method: 'POST', body: 'not json' })).status).toBe(400)
    expect((await fetch(`${base}/design/app-1abc/ops`, { method: 'POST', body: '{"ops":[]}' })).status).toBe(400)

    ui.close()
    await host.close()
  })

  it('explains that an unopened board has no page yet', async () => {
    const host = await startHost(tmpDir('design-http-empty'))
    const base = `http://127.0.0.1:${host.server.port()}`
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    ui.send({ type: 'design.create', boardId: 'raw-1abc', name: 'Raw' })
    await ui.waitFor(m => m.type === 'design.boards')

    const post = await fetch(`${base}/design/raw-1abc/ops`, {
      method: 'POST',
      body: JSON.stringify({ ops: [{ op: 'create', kind: 'rectangle', x: 0, y: 0 }] })
    })
    expect(post.status).toBe(200)
    const { results } = (await post.json()) as { results: DesignOpResult[] }
    expect(results[0].error).toContain('opened')

    ui.close()
    await host.close()
  })
})
