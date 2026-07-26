import { describe, expect, it } from 'vitest'
import { applyDesignOps, boardSummary } from '../src/server/designops'
import { nodeStyle } from '../src/renderer/src/design/nodeCss'
import type { DesignDocument, DesignOpResult } from '../src/shared/design'
import { nodeDefaults, type DesignNodeProps } from '../src/shared/designNode'
import { startHost, TestUi, tmpDir } from './helpers/session'

const PAGE = { id: 'page:page', typeName: 'page', name: 'Page 1', index: 'a1', meta: {} }

function freshDocument(): DesignDocument {
  return { store: { 'page:page': { ...PAGE } }, schema: null }
}

function propsOf(document: DesignDocument, id: string): DesignNodeProps {
  return (document.store[id] as { props: DesignNodeProps }).props
}

describe('design nodes', () => {
  it('creates a node with real design properties', () => {
    const document = freshDocument()
    const applied = applyDesignOps(document, [
      {
        op: 'node',
        x: 0,
        y: 0,
        w: 360,
        h: 220,
        name: 'Card',
        radius: 20,
        fills: [{ type: 'solid', color: '#141414', opacity: 1, visible: true }],
        strokes: [{ color: '#ffffff14', weight: 1, align: 'inside', style: 'solid', visible: true }],
        effects: [{ type: 'shadow', x: 0, y: 8, blur: 24, spread: -4, color: '#00000059', visible: true }],
        layout: { direction: 'column', gap: 12, padding: [20, 20, 20, 20] }
      }
    ])
    expect(applied.results[0].error).toBeUndefined()
    const props = propsOf(document, applied.results[0].id!)
    expect(props.radius).toEqual([20, 20, 20, 20])
    expect(props.fills).toEqual([{ type: 'solid', color: '#141414', opacity: 1 }])
    expect(props.strokes[0].weight).toBe(1)
    expect(props.effects[0]).toMatchObject({ type: 'shadow', y: 8, spread: -4 })
    expect(props.layout).toMatchObject({ direction: 'column', gap: 12, padding: [20, 20, 20, 20] })
    expect((document.store[applied.results[0].id!] as { type: string }).type).toBe('design-node')
  })

  it('drops paints and effects it cannot trust instead of writing junk', () => {
    const document = freshDocument()
    const applied = applyDesignOps(document, [
      {
        op: 'node',
        x: 0,
        y: 0,
        fills: [{ type: 'solid', color: 'red', opacity: 1 }, { type: 'nonsense' }, { type: 'solid', color: '#ff0000', opacity: 0.5 }],
        strokes: [{ color: 'not a hex', weight: 4 }],
        effects: [{ type: 'shadow', color: '#00000040' }, { type: 'made-up' }]
      }
    ])
    const props = propsOf(document, applied.results[0].id!)
    expect(props.fills).toEqual([{ type: 'solid', color: '#ff0000', opacity: 0.5 }])
    expect(props.strokes).toEqual([])
    expect(props.effects).toHaveLength(1)
  })

  it('reports a bad shape of input rather than silently ignoring it', () => {
    const document = freshDocument()
    const applied = applyDesignOps(document, [
      { op: 'node', x: 0, y: 0, fills: { type: 'solid' } as unknown as unknown[] },
      { op: 'node', x: 0, y: 0, radius: [4, 4] },
      { op: 'node', x: Number.NaN, y: 0 }
    ])
    expect(applied.results[0].error).toContain('fills')
    expect(applied.results[1].error).toContain('radius')
    expect(applied.results[2].error).toContain('numbers')
    expect(applied.put).toHaveLength(0)
  })

  it('merges set onto what is already there and nests inside another node', () => {
    const document = freshDocument()
    const [card] = applyDesignOps(document, [
      { op: 'node', x: 0, y: 0, w: 400, h: 300, name: 'Card', radius: 16, fills: [{ type: 'solid', color: '#141414', opacity: 1 }] }
    ]).results
    const [label] = applyDesignOps(document, [
      { op: 'node', x: 20, y: 20, parent: card.id, text: 'Revenue', type: { size: 20, weight: 600, color: '#ffffff' } }
    ]).results
    expect((document.store[label.id!] as { parentId: string }).parentId).toBe(card.id)
    expect(propsOf(document, label.id!).type).toMatchObject({ size: 20, weight: 600 })

    applyDesignOps(document, [{ op: 'set', id: card.id!, radius: [16, 16, 0, 0], x: 40 }])
    const props = propsOf(document, card.id!)
    expect(props.radius).toEqual([16, 16, 0, 0])
    expect(props.name).toBe('Card')
    expect(props.fills).toHaveLength(1)
    expect((document.store[card.id!] as { x: number }).x).toBe(40)
  })

  it('points set at older shapes back to the right op', () => {
    const document = freshDocument()
    const [box] = applyDesignOps(document, [{ op: 'create', kind: 'rectangle', x: 0, y: 0 }]).results
    const applied = applyDesignOps(document, [{ op: 'set', id: box.id!, radius: 8 }])
    expect(applied.results[0].error).toContain('update')
  })

  it('reads nodes back with every property an agent needs to keep designing', () => {
    const document = freshDocument()
    applyDesignOps(document, [
      { op: 'node', x: 10, y: 20, w: 100, h: 40, name: 'Pill', radius: 999, text: 'Live' }
    ])
    const summary = boardSummary('b-1abc', 'Board', document) as {
      shapes: Array<{ kind: string; name?: string; radius?: number[]; text?: string; x?: number }>
    }
    const node = summary.shapes.find(shape => shape.kind === 'node')
    expect(node).toMatchObject({ name: 'Pill', text: 'Live', x: 10 })
    expect(node?.radius).toEqual([999, 999, 999, 999])
  })
})

describe('node styling', () => {
  it('turns design properties into the css that draws them', () => {
    const style = nodeStyle({
      ...nodeDefaults(),
      radius: [20, 20, 0, 0],
      fills: [{ type: 'linear', angle: 160, stops: [{ color: '#1e293b', at: 0 }, { color: '#0f172a', at: 1 }], opacity: 1 }],
      strokes: [{ color: '#ffffff14', weight: 1, align: 'inside', style: 'solid' }],
      effects: [{ type: 'shadow', x: 0, y: 8, blur: 24, spread: -4, color: '#00000059' }]
    })
    expect(style.borderRadius).toBe('20px 20px 0px 0px')
    expect(style.backgroundImage).toBe('linear-gradient(160deg, #1e293b 0%, #0f172a 100%)')
    expect(style.boxShadow).toBe('inset 0 0 0 1px #ffffff14, 0px 8px 24px -4px #00000059')
  })

  it('gives a background blur effect a real backdrop filter', () => {
    const style = nodeStyle({
      ...nodeDefaults(),
      effects: [{ type: 'background-blur', blur: 24 }]
    })
    expect(style.backdropFilter).toContain('blur(24px)')
  })

  it('lays out a container with flexbox when it has auto layout', () => {
    const style = nodeStyle({
      ...nodeDefaults(),
      layout: { direction: 'row', gap: 12, padding: [8, 16, 8, 16], align: 'center', justify: 'between', wrap: false, sizeW: 'fixed', sizeH: 'hug' }
    })
    expect(style.display).toBe('flex')
    expect(style.flexDirection).toBe('row')
    expect(style.gap).toBe('12px')
    expect(style.padding).toBe('8px 16px 8px 16px')
    expect(style.justifyContent).toBe('space-between')
  })
})

describe('design nodes over HTTP', () => {
  it('lets an agent build a node and read it back', async () => {
    const host = await startHost(tmpDir('design-node-http'))
    const base = `http://127.0.0.1:${host.server.port()}`
    const ui = await TestUi.connect(host.url, 'sam', host.code)

    ui.send({ type: 'design.create', boardId: 'node-1abc', name: 'Nodes' })
    ui.send({ type: 'design.init', boardId: 'node-1abc', document: { store: { 'page:page': { ...PAGE } }, schema: null } })
    await ui.waitFor(m => m.type === 'design.boards')

    const post = await fetch(`${base}/design/node-1abc/ops`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agent: 'jamel/fake',
        ops: [
          {
            op: 'node',
            x: 0,
            y: 0,
            w: 320,
            h: 180,
            name: 'Panel',
            radius: 24,
            fills: [{ type: 'solid', color: '#141414', opacity: 1 }]
          }
        ]
      })
    })
    const { results } = (await post.json()) as { results: DesignOpResult[] }
    expect(results[0].id).toMatch(/^shape:/)

    const summary = (await (await fetch(`${base}/design/node-1abc`)).json()) as {
      shapes: Array<{ kind: string; name?: string; fills?: Array<{ type: string }> }>
    }
    const node = summary.shapes.find(shape => shape.kind === 'node')
    expect(node?.name).toBe('Panel')
    expect(node?.fills?.[0].type).toBe('solid')

    ui.close()
    await host.close()
  })
})
