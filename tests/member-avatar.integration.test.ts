import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ServerMessage } from '../src/shared/protocol'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'

type Avatar = Extract<ServerMessage, { type: 'member.avatar' }>

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const image = (name = 'face.png', mime = 'image/png', data = PNG.toString('base64')) => ({ name, mime, data })

const memberIn = (host: TestHost, name: string) =>
  host.session.snapshot().members.find(m => m.name.toLowerCase() === name)

describe('your own photo', () => {
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

  it('puts an uploaded photo on you and takes it back off', async () => {
    const ui = await TestUi.connect(host.url, 'jamel', host.code)
    const other = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui, other)

    ui.send({ type: 'member.avatar', image: image() })
    const set = (await other.waitFor(m => m.type === 'member.avatar')) as Avatar
    expect(set.memberId).toBe(memberIn(host, 'jamel')?.id)
    expect(set.file).toMatch(/\.png$/)
    expect(memberIn(host, 'jamel')?.avatar).toBe(set.file)

    const onDisk = path.join(host.repoPath, '.crew', 'attachments', set.file!)
    expect(fs.readFileSync(onDisk).equals(PNG)).toBe(true)
    expect(host.store.loadSession()?.members.find(m => m.name === 'jamel')?.avatar).toBe(set.file)

    ui.send({ type: 'member.avatar', image: null })
    await other.waitFor(m => m.type === 'member.avatar' && m.file === null)
    expect(memberIn(host, 'jamel')?.avatar).toBeUndefined()
    expect(host.store.loadSession()?.members.find(m => m.name === 'jamel')?.avatar).toBeUndefined()
  })

  it('only ever lands on whoever sent it, and takes nothing that is not an image', async () => {
    const ui = await TestUi.connect(host.url, 'jamel', host.code)
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui, sam)

    sam.send({ type: 'member.avatar', image: image('mine.png') })
    await waitUntil(() => !!memberIn(host, 'sam')?.avatar)
    expect(memberIn(host, 'jamel')?.avatar).toBeUndefined()

    ui.send({ type: 'member.avatar', image: image('notes.pdf', 'application/pdf') })
    await new Promise(r => setTimeout(r, 300))
    expect(memberIn(host, 'jamel')?.avatar).toBeUndefined()
  })

  it('is still on when the session comes back up', async () => {
    const ui = await TestUi.connect(host.url, 'jamel', host.code)
    uis.push(ui)

    ui.send({ type: 'member.avatar', image: image() })
    const set = (await ui.waitFor(m => m.type === 'member.avatar')) as Avatar

    const again = await TestUi.connect(host.url, 'jamel', host.code)
    uis.push(again)
    const welcome = again.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
    expect(welcome.snapshot.members.find(m => m.name === 'jamel')?.avatar).toBe(set.file)
  })
})
