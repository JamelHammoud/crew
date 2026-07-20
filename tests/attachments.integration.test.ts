import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agentId } from '../src/shared/llm'
import type { SessionEvent } from '../src/shared/events'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, tmpDir, type TestHost } from './helpers/session'

type Message = Extract<SessionEvent, { kind: 'message' }>
type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const image = (name = 'shot.png', data = PNG.toString('base64')) => ({
  name,
  mime: 'image/png',
  data
})

describe('image attachments', () => {
  let host: TestHost
  let runners: Runner[] = []
  let uis: TestUi[] = []

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.close()
    uis = []
    runners = []
    await host.close()
  })

  async function connectRunner(name: string, repoPath = host.repoPath) {
    const runner = new Runner({
      name,
      code: host.code,
      repoPath,
      providers: [makeFakeProvider()],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await new Promise<void>(resolve => {
      runner.onStatus = status => {
        if (status === 'online') resolve()
      }
    })
    return runner
  }

  const fake = agentId('jamel', 'fake')

  it('stores an image sent with a message and shares it with everyone', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    const other = await TestUi.connect(host.url, 'ali', host.code)
    uis.push(ui, other)

    ui.send({ type: 'chat.send', text: 'look at this', mentions: [], attachments: [image()] })

    const seen = (await other.waitForEvent(e => e.kind === 'message')) as Message
    expect(seen.attachments).toHaveLength(1)
    const [attachment] = seen.attachments!
    expect(attachment.name).toBe('shot.png')
    expect(attachment.mime).toBe('image/png')
    expect(attachment.size).toBe(PNG.length)
    expect(attachment.file).toBe(`${attachment.id}.png`)

    const onDisk = path.join(host.repoPath, '.crew', 'attachments', attachment.file)
    expect(fs.readFileSync(onDisk).equals(PNG)).toBe(true)

    const persisted = host.store.loadEvents().find((e): e is Message => e.kind === 'message')
    expect(persisted?.attachments?.[0].file).toBe(attachment.file)
  })

  it('serves the image over http and refuses anything else', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    ui.send({ type: 'chat.send', text: 'look', mentions: [], attachments: [image()] })
    const sent = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    const base = host.url.replace(/^ws/, 'http').replace(/\/ws$/, '')

    const res = await fetch(`${base}/attachments/${sent.attachments![0].file}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true)

    expect((await fetch(`${base}/attachments/nope.png`)).status).toBe(404)
    expect((await fetch(`${base}/attachments/..%2F..%2Fsession.json`)).status).toBe(404)
  })

  it('sends a message with only an image', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.send({ type: 'chat.send', text: '', mentions: [fake], attachments: [image('diagram.png')] })
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    expect(started.title).toBe('diagram.png')

    const end = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended
    expect(end.ok).toBe(true)
  })

  it('gives the agent a path it can read the image from', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.send({ type: 'chat.send', text: 'what is this @Fake', mentions: [fake], attachments: [image()] })
    const sent = (await ui.waitForEvent(e => e.kind === 'message' && !!e.threadId)) as Message
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end')) as Ended

    const expected = path.join(host.repoPath, '.crew', 'attachments', sent.attachments![0].file)
    expect(end.text).toContain(expected)
    expect(end.text).toContain('[image: shot.png]')
  })

  it('downloads the image when the agent runs from another folder', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const away = tmpDir('runner')
    await connectRunner('jamel', away)
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.send({ type: 'chat.send', text: 'read it @Fake', mentions: [fake], attachments: [image()] })
    const sent = (await ui.waitForEvent(e => e.kind === 'message' && !!e.threadId)) as Message
    await ui.waitForEvent(e => e.kind === 'agent.end')

    const copied = path.join(away, '.crew', 'attachments', sent.attachments![0].file)
    expect(fs.readFileSync(copied).equals(PNG)).toBe(true)
  })

  it('turns away files that are not images or are too big', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)

    ui.send({
      type: 'chat.send',
      text: 'files',
      mentions: [],
      attachments: [
        { name: 'notes.pdf', mime: 'application/pdf', data: PNG.toString('base64') },
        { name: 'huge.png', mime: 'image/png', data: Buffer.alloc(11 * 1024 * 1024).toString('base64') },
        image('fine.png')
      ]
    })

    const seen = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    expect(seen.attachments?.map(a => a.name)).toEqual(['fine.png'])
  })
})
