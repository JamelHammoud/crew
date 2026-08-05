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
    const base = `http://127.0.0.1:${host.server.port()}/${host.code}`

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
    expect(host.session.attachmentLimit()).toBe(50 * 1000 * 1000)

    const runner = new WebSocket(host.url)
    await new Promise<void>((resolve, reject) => {
      runner.on('open', () => resolve())
      runner.on('error', reject)
    })
    runner.send(JSON.stringify({ type: 'hello', role: 'runner', name: 'sam', code: host.code, llms: [] }))
    runner.send(JSON.stringify({ type: 'attachment.limit', mb: 1 }))
    await new Promise(r => setTimeout(r, 200))
    runner.close()
    expect(host.session.attachmentLimit()).toBe(50 * 1000 * 1000)
  })

  it('takes anything at all once the limit is off', async () => {
    const sam = await connect('sam')
    sam.send({ type: 'attachment.limit', mb: ATTACHMENT_UNLIMITED })
    await sam.waitForEvent(e => e.kind === 'attachment.limit')
    expect(host.session.attachmentLimit()).toBe(Number.POSITIVE_INFINITY)

    const base = `http://127.0.0.1:${host.server.port()}/${host.code}`
    expect((await upload(base, 12 * 1024 * 1024)).status).toBe(200)

    await host.close()
    host = await startHost(repoPath)
    const back = await connect('sam')
    expect(welcome(back).attachmentMb).toBe(ATTACHMENT_UNLIMITED)
    expect(host.session.attachmentLimit()).toBe(Number.POSITIVE_INFINITY)
  })

  // A file lands in the history the crew syncs and every machine here pulls its
  // own copy, so the biggest sizes are offered only while the crew is this
  // machine's own.
  it('offers the big sizes on your own crew and not on a shared one', () => {
    const alone = attachmentMbChoices(false, DEFAULT_ATTACHMENT_MB)
    expect(alone).toContain(ATTACHMENT_MB_LIMIT)
    expect(alone.at(-1)).toBe(ATTACHMENT_UNLIMITED)

    const shared = attachmentMbChoices(true, DEFAULT_ATTACHMENT_MB)
    expect(shared).not.toContain(ATTACHMENT_UNLIMITED)
    expect(Math.max(...shared)).toBe(SHARED_ATTACHMENT_MB)

    // A number picked before anybody was invited is the crew's, so it still
    // stands, and it is offered where its own size falls.
    expect(attachmentMbChoices(true, 2000).at(-1)).toBe(2000)
    expect(attachmentMbChoices(true, ATTACHMENT_UNLIMITED).at(-1)).toBe(ATTACHMENT_UNLIMITED)
    expect(attachmentMbChoices(true, 5)).toEqual(shared)
  })

  it('says a size in the words somebody would use for it', () => {
    expect(attachmentMbLabel(10)).toBe('10 MB')
    expect(attachmentMbLabel(500)).toBe('500 MB')
    expect(attachmentMbLabel(1000)).toBe('1 GB')
    expect(attachmentMbLabel(5000)).toBe('5 GB')
    expect(attachmentMbLabel(ATTACHMENT_MB_LIMIT)).toBe('10 GB')
    expect(attachmentMbLabel(ATTACHMENT_UNLIMITED)).toBe('No limit')
  })

  // A thousand of one unit is one of the next, the way the Finder counts, and
  // nothing ever stands in four digits of the unit below it.
  it('says a file the size the machine says it is', () => {
    expect(fileSize(0)).toBe('0 B')
    expect(fileSize(999)).toBe('999 B')
    expect(fileSize(1_000)).toBe('1 KB')
    expect(fileSize(1_500)).toBe('1.5 KB')
    expect(fileSize(999_000)).toBe('999 KB')
    expect(fileSize(1_000_000)).toBe('1 MB')
    expect(fileSize(1_440_000)).toBe('1.4 MB')
    expect(fileSize(14_400_000)).toBe('14 MB')
    expect(fileSize(700_000_000)).toBe('700 MB')
    expect(fileSize(999_600_000)).toBe('1 GB')
    expect(fileSize(3_000_000_000)).toBe('3 GB')
  })

  it('refuses a number nobody could have meant', () => {
    expect(cleanAttachmentMb(10)).toBe(10)
    expect(cleanAttachmentMb(ATTACHMENT_UNLIMITED)).toBe(ATTACHMENT_UNLIMITED)
    expect(cleanAttachmentMb(-5)).toBeNull()
    expect(cleanAttachmentMb(ATTACHMENT_MB_LIMIT + 1)).toBeNull()
    expect(cleanAttachmentMb(Number.NaN)).toBeNull()
    expect(cleanAttachmentMb(Number.POSITIVE_INFINITY)).toBeNull()
    expect(cleanAttachmentMb('10')).toBeNull()
    expect(cleanAttachmentMb(undefined)).toBeNull()
  })

  it('leaves the number where it is when a window asks for junk', async () => {
    const ui = await connect('sam')
    ui.send({ type: 'attachment.limit', mb: -1 })
    ui.send({ type: 'attachment.limit', mb: 5 })
    const said = (await ui.waitForEvent(e => e.kind === 'attachment.limit')) as Limit
    expect(said.mb).toBe(5)
    expect(ui.events.filter(e => e.kind === 'attachment.limit')).toHaveLength(1)
  })
})
