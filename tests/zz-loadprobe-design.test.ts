import { afterEach, describe, expect, it } from 'vitest'
import { startHost, TestUi, tmpDir, waitUntil, type TestHost } from './helpers/session'
import type { DesignDocument } from '../src/shared/design'

const hosts: TestHost[] = []
const uis: TestUi[] = []

afterEach(async () => {
  for (const ui of uis.splice(0)) ui.close()
  for (const h of hosts.splice(0)) await h.close().catch(() => {})
})

function ms(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e6
}

function shape(id: string): Record<string, unknown> {
  return {
    id,
    typeName: 'shape',
    type: 'geo',
    x: Math.random() * 5000,
    y: Math.random() * 5000,
    rotation: 0,
    index: 'a1',
    parentId: 'page:page',
    isLocked: false,
    opacity: 1,
    props: {
      w: 120,
      h: 80,
      geo: 'rectangle',
      color: 'black',
      fill: 'solid',
      dash: 'draw',
      size: 'm',
      text: `shape ${id}`,
      font: 'sans',
      align: 'middle',
      verticalAlign: 'middle',
      growY: 0,
      url: ''
    },
    meta: { fills: [{ color: '#ffffff', visible: true }], strokes: [], effects: [] }
  }
}

describe('load: design board size', () => {
  it('measures board persistence and join cost as shapes pile up', async () => {
    const host = await startHost(tmpDir('design'))
    hosts.push(host)
    const ui = await TestUi.connect(host.url, 'artist', host.code)
    uis.push(ui)

    ui.send({ type: 'design.create', boardId: 'b1', name: 'Board' })
    await waitUntil(() => host.session.snapshot().boards?.some(b => b.id === 'b1') === true)
    const doc: DesignDocument = {
      store: { 'page:page': { id: 'page:page', typeName: 'page', name: 'Page', index: 'a1', meta: {} } },
      schema: null
    } as never
    ui.send({ type: 'design.init', boardId: 'b1', document: doc })
    await waitUntil(() => designStoreSize(host, 'b1') >= 1)

    const table: Array<Record<string, unknown>> = []
    let made = 0
    for (const target of [200, 1000, 3000, 8000, 20000]) {
      const applyStart = process.hrtime.bigint()
      // Batches of 100, the way a paste or an agent op lands.
      while (made < target) {
        const batch = []
        for (let i = 0; i < 100 && made < target; i++, made++) batch.push(shape(`shape:s${made}`))
        ui.send({ type: 'design.apply', boardId: 'b1', put: batch })
      }
      await waitUntil(() => designStoreSize(host, 'b1') >= target + 1, 120000)
      const applyMs = ms(applyStart)

      const board = designBoard(host, 'b1')
      const serStart = process.hrtime.bigint()
      const json = JSON.stringify({ name: board.name, document: board.document })
      const serMs = ms(serStart)

      const saveStart = process.hrtime.bigint()
      host.store.saveDesign('b1', { name: board.name, document: board.document })
      const saveMs = ms(saveStart)

      // What a person joining has to pull down before the board draws.
      const snapMs0 = process.hrtime.bigint()
      const wire = JSON.stringify({
        type: 'design.snapshot',
        boardId: 'b1',
        name: board.name,
        document: board.document,
        presence: []
      })
      const snapMs = ms(snapMs0)

      table.push({
        shapes: target,
        applyMs: +applyMs.toFixed(0),
        docMB: +(json.length / 1024 / 1024).toFixed(2),
        serializeMs: +serMs.toFixed(1),
        saveToDiskMs: +saveMs.toFixed(1),
        snapshotWireMB: +(wire.length / 1024 / 1024).toFixed(2),
        snapshotBuildMs: +snapMs.toFixed(1),
        // Every 500ms while anyone draws, this whole cost is paid again.
        savesPerSecondCost: +((saveMs + serMs) * 2).toFixed(1)
      })
    }
    console.log('\n=== DESIGN BOARD ===\n' + JSON.stringify(table, null, 1))
    expect(table.length).toBe(5)
  }, 600000)
})

function designBoard(host: TestHost, id: string): { name: string; document: DesignDocument } {
  const designs = (host.session as unknown as { designs: Map<string, { name: string; document: DesignDocument }> })
    .designs
  return designs.get(id)!
}

function designStoreSize(host: TestHost, id: string): number {
  const board = designBoard(host, id)
  return board?.document ? Object.keys(board.document.store).length : 0
}
