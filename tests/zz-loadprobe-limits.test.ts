import { afterEach, describe, expect, it } from 'vitest'
import { MAX_HUDDLE_PEERS } from '../src/shared/huddle'
import { startHost, TestUi, tmpDir, waitUntil, type TestHost } from './helpers/session'

const hosts: TestHost[] = []
const uis: TestUi[] = []

afterEach(async () => {
  for (const ui of uis.splice(0)) ui.close()
  for (const h of hosts.splice(0)) await h.close().catch(() => {})
})

async function host(): Promise<TestHost> {
  const h = await startHost(tmpDir('limits'))
  hosts.push(h)
  return h
}

describe('probe: a message sent to an unknown thread', () => {
  it('is dropped with no word to the person who sent it', async () => {
    const h = await host()
    const ui = await TestUi.connect(h.url, 'sam', h.code)
    uis.push(ui)

    const before = ui.messages.length
    ui.send({ type: 'chat.send', text: 'this message matters', mentions: [], threadId: 'a-thread-that-is-gone' })
    await new Promise(r => setTimeout(r, 600))

    const after = ui.messages.slice(before)
    const errors = after.filter(m => m.type === 'error')
    const events = after.filter(m => m.type === 'event')

    console.log(
      '\n=== SILENT DROP ===\n' +
        JSON.stringify(
          {
            repliesFromHost: after.length,
            errorsShown: errors.length,
            eventsEmitted: events.length,
            landedInLog: h.store.loadEvents().some(e => JSON.stringify(e).includes('this message matters'))
          },
          null,
          1
        )
    )
    // Nothing comes back and nothing is written down. The typing is simply gone.
    expect(errors.length).toBe(0)
    expect(h.store.loadEvents().some(e => JSON.stringify(e).includes('this message matters'))).toBe(false)
  }, 60000)
})

describe('probe: huddle mesh cost', () => {
  it('works out what a full room asks of one machine', () => {
    // Every connection carries microphone, camera and screen, everyone to
    // everyone, so each person holds a line to each of the others.
    const rows = [2, 4, 6, 8, 10, 12, 16, 20].map(people => {
      const linksPerPerson = people - 1
      const totalLinks = (people * linksPerPerson) / 2
      // Rough, steady-state: 40kbps voice, 1.2Mbps camera, 2.5Mbps screen.
      const upCameraMbps = (linksPerPerson * 1.2).toFixed(1)
      const downCameraMbps = (linksPerPerson * 1.2).toFixed(1)
      const upAllOnMbps = (linksPerPerson * (1.2 + 2.5 + 0.04)).toFixed(1)
      return {
        people,
        linksPerPerson,
        totalLinks,
        slotsPerPerson: linksPerPerson * 3,
        upCameraMbps: +upCameraMbps,
        downCameraMbps: +downCameraMbps,
        upEverythingOnMbps: +upAllOnMbps,
        overTypicalHomeUpload: +upCameraMbps > 10
      }
    })
    console.log('\n=== HUDDLE MESH (cap is ' + MAX_HUDDLE_PEERS + ') ===\n' + JSON.stringify(rows, null, 1))
    expect(MAX_HUDDLE_PEERS).toBe(12)
  })
})

describe('probe: unbounded stores', () => {
  it('shows nothing prunes the log, the attachments or the removed list', async () => {
    const h = await host()
    const ui = await TestUi.connect(h.url, 'sam', h.code)
    uis.push(ui)

    for (let i = 0; i < 1200; i++) ui.chat(`filler ${i}`)
    await waitUntil(() => h.store.loadEvents().length >= 1200, 60000)

    const events = h.store.loadEvents()
    const snap = h.session.snapshot()
    console.log(
      '\n=== UNBOUNDED ===\n' +
        JSON.stringify(
          {
            onDisk: events.length,
            inSnapshot: snap.events.length,
            heldInMemory: (h.session as unknown as { events: unknown[] }).events.length,
            // The snapshot is capped, the log and the memory are not.
            snapshotIsCapped: snap.events.length < events.length,
            memoryIsCapped: (h.session as unknown as { events: unknown[] }).events.length < events.length
          },
          null,
          1
        )
    )
    expect(snap.events.length).toBeLessThan(events.length)
  }, 120000)
})
