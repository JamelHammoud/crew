import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ServerMessage } from '../src/shared/protocol'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Renamed = Extract<ServerMessage, { type: 'member.renamed' }>

describe('your name', () => {
  let host: TestHost
  let uis: TestUi[] = []

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    uis = []
    await host.close()
  })

  it('renames the same member for everyone and keeps the name', async () => {
    const ui = await TestUi.connect(host.url, 'Jamel (dev)', host.code)
    const other = await TestUi.connect(host.url, 'Ali', host.code)
    uis.push(ui, other)
    const id = ui.selfId

    ui.send({ type: 'member.rename', name: '  Jamel   High  ' })
    const changed = (await other.waitFor(message => message.type === 'member.renamed')) as Renamed

    expect(changed).toMatchObject({ fromId: id, member: { id, name: 'Jamel High', connected: true } })
    expect(host.session.snapshot().members.find(member => member.id === id)?.name).toBe('Jamel High')
    expect(host.session.snapshot().members.some(member => member.name === 'Jamel (dev)')).toBe(false)
    expect(host.store.loadSession()?.members.find(member => member.id === id)?.name).toBe('Jamel High')

    const again = await TestUi.connect(host.url, 'Jamel High', host.code)
    uis.push(again)
    expect(again.selfId).toBe(id)
  })

  it('switches to an existing account without leaving a duplicate member', async () => {
    const jamel = await TestUi.connect(host.url, 'Jamel', host.code)
    const dev = await TestUi.connect(host.url, 'Jamel (dev)', host.code)
    uis.push(jamel, dev)
    const oldId = dev.selfId

    dev.send({ type: 'member.rename', name: 'Jamel' })
    const changed = (await dev.waitFor(message => message.type === 'member.renamed')) as Renamed

    expect(changed.fromId).toBe(oldId)
    expect(changed.member.id).toBe(jamel.selfId)
    expect(host.session.snapshot().members.filter(member => member.name === 'Jamel')).toHaveLength(1)
    expect(host.session.snapshot().members.some(member => member.id === oldId)).toBe(false)

    dev.chat('from this account')
    const message = await jamel.waitForEvent(event => event.kind === 'message' && event.text === 'from this account')
    expect(message).toMatchObject({ authorId: jamel.selfId, authorName: 'Jamel' })
  })
})
