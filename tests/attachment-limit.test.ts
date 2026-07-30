import WebSocket from 'ws'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ATTACHMENT_MB_LIMIT,
  ATTACHMENT_UNLIMITED,
  attachmentMbChoices,
  attachmentMbLabel,
  cleanAttachmentMb,
  DEFAULT_ATTACHMENT_MB,
  fileSize,
  SHARED_ATTACHMENT_MB
} from '../src/shared/attachments'
import type { SessionEvent } from '../src/shared/events'
import type { SessionSnapshot } from '../src/shared/protocol'
import { startHost, TestUi, tmpDir, type TestHost } from './helpers/session'

type Limit = Extract<SessionEvent, { kind: 'attachment.limit' }>

const welcome = (ui: TestUi): SessionSnapshot => {
  const said = ui.messages.find(m => m.type === 'welcome')
  if (said?.type !== 'welcome') throw new Error('no welcome')
  return said.snapshot
}

const upload = (base: string, bytes: number): Promise<Response> =>
  fetch(`${base}/attachments`, {
    method: 'POST',
    headers: { 'content-type': 'application/pdf', 'x-attachment-name': 'notes.pdf' },
    body: Buffer.alloc(bytes)
  })

describe('how big a file may be', () => {
  let host: TestHost
  let uis: TestUi[] = []
  let repoPath = ''

  beforeEach(async () => {
    repoPath = tmpDir('limit')
    host = await startHost(repoPath)
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    uis = []
    await host.close()
  })

  const connect = async (name: string) => {
    const ui = await TestUi.connect(host.url, name, host.code)
    uis.push(ui)
    return ui
  }

  it('starts at ten megabytes and says so in the snapshot', async () => {
    const ui = await connect('sam')
    expect(welcome(ui).attachmentMb).toBe(DEFAULT_ATTACHMENT_MB)
  })

  it('is one number for everyone, and the host turns away what is over it', async () => {
    const sam = await connect('sam')
    const ali = await connect('ali')
    const base = `http://127.0.0.1:${host.server.port()}`

    expect((await upload(base, 3 * 1024 * 1024)).status).toBe(200)

    sam.send({ type: 'attachment.limit', mb: 1 })
    const said = (await ali.waitForEvent(e => e.kind === 'attachment.limit')) as Limit
    expect(said.mb).toBe(1)
    expect(said.byName).toBe('sam')

    expect((await upload(base, 3 * 1024 * 1024)).status).toBe(413)
    expect((await upload(base, 512 * 1024)).status).toBe(200)

    const later = await connect('kim')
    expect(welcome(later).attachmentMb).toBe(1)
  })

  it('holds a message to the same number', async () => {
    const ui = await connect('sam')
    ui.send({ type: 'attachment.limit', mb: 1 })
    await ui.waitForEvent(e => e.kind === 'attachment.limit')

    const big = { name: 'big.pdf', mime: 'application/pdf', data: Buffer.alloc(2 * 1024 * 1024).toString('base64') }
    const small = { name: 'small.pdf', mime: 'application/pdf', data: Buffer.from('%PDF-1.4 hi').toString('base64') }
    ui.send({ type: 'chat.send', text: 'both', mentions: [], attachments: [big, small] })

    const message = await ui.waitForEvent(e => e.kind === 'message')
    const carried = message.kind === 'message' ? (message.attachments ?? []) : []
    expect(carried.map(one => one.name)).toEqual(['small.pdf'])
  })

  it('is still the same number after the host comes back up', async () => {
    const sam = await connect('sam')
    sam.send({ type: 'attachment.limit', mb: 25 })
    await sam.waitForEvent(e => e.kind === 'attachment.limit')
    await host.close()

    host = await startHost(repoPath)
    const back = await connect('sam')
    expect(welcome(back).attachmentMb).toBe(25)
  })

  // The controls a crew shares are refused from a runner, the way the music's
  // are: an agent's machine is connected the whole time it is joined.
  it('takes nothing a runner says about it', async () => {
    const ui = await connect('sam')
    ui.send({ type: 'attachment.limit', mb: 50 })
    await ui.waitForEvent(e => e.kind === 'attachment.limit')
    expect(host.session.attachmentLimit()).toBe(50 * 1024 * 1024)

    const runner = new WebSocket(host.url)
    await new Promise<void>((resolve, reject) => {
      runner.on('open', () => resolve())
      runner.on('error', reject)
    })
    runner.send(JSON.stringify({ type: 'hello', role: 'runner', name: 'sam', code: host.code, llms: [] }))
    runner.send(JSON.stringify({ type: 'attachment.limit', mb: 1 }))
    await new Promise(r => setTimeout(r, 200))
    runner.close()
    expect(host.session.attachmentLimit()).toBe(50 * 1024 * 1024)
  })

  it('refuses a number nobody could have meant', () => {
    expect(cleanAttachmentMb(10)).toBe(10)
    expect(cleanAttachmentMb(0)).toBeNull()
    expect(cleanAttachmentMb(-5)).toBeNull()
    expect(cleanAttachmentMb(ATTACHMENT_MB_LIMIT + 1)).toBeNull()
    expect(cleanAttachmentMb(Number.NaN)).toBeNull()
    expect(cleanAttachmentMb(Number.POSITIVE_INFINITY)).toBeNull()
    expect(cleanAttachmentMb('10')).toBeNull()
    expect(cleanAttachmentMb(undefined)).toBeNull()
  })

  it('leaves the number where it is when a window asks for junk', async () => {
    const ui = await connect('sam')
    ui.send({ type: 'attachment.limit', mb: 0 })
    ui.send({ type: 'attachment.limit', mb: 5 })
    const said = (await ui.waitForEvent(e => e.kind === 'attachment.limit')) as Limit
    expect(said.mb).toBe(5)
    expect(ui.events.filter(e => e.kind === 'attachment.limit')).toHaveLength(1)
  })
})
