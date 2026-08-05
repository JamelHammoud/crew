import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { attachmentBytes, DEFAULT_ATTACHMENT_MB } from '../src/shared/attachments'
import type { SessionEvent } from '../src/shared/events'
import { MAX_FRAME_BYTES } from '../src/shared/protocol'
import { startHost, TestUi, tmpDir, type TestHost } from './helpers/session'

type Message = Extract<SessionEvent, { kind: 'message' }>

const TEN_MB = 10 * 1024 * 1024

const payload = (() => {
  const bytes = Buffer.alloc(TEN_MB)
  for (let at = 0; at < bytes.length; at++) bytes[at] = (at * 31 + (at >> 11)) & 0xff
  return bytes
})()

const post = (base: string, body: Buffer, name: string): Promise<Response> =>
  fetch(`${base}/attachments`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'x-attachment-name': encodeURIComponent(name) },
    body
  })

describe('a ten megabyte file through the host', () => {
  let host: TestHost
  let uis: TestUi[] = []
  let base = ''

  beforeEach(async () => {
    host = await startHost(tmpDir('throughput'))
    base = `http://127.0.0.1:${host.server.port()}/${host.code}`
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

  const raiseTo = async (ui: TestUi, mb: number) => {
    ui.send({ type: 'attachment.limit', mb })
    await ui.waitForEvent(e => e.kind === 'attachment.limit')
  }

  const dir = () => path.join(host.repoPath, '.crew', 'attachments')

  it('carries it in a message and lands every byte of it', async () => {
    const ui = await connect('sam')
    await raiseTo(ui, 25)

    const data = payload.toString('base64')
    expect(data.length).toBeGreaterThan(payload.length)
    expect(data.length).toBeLessThan(MAX_FRAME_BYTES)

    ui.send({
      type: 'chat.send',
      text: 'the whole thing',
      mentions: [],
      attachments: [{ name: 'big.bin', mime: 'application/octet-stream', data }]
    })

    const seen = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    const [one] = seen.attachments!
    expect(one.name).toBe('big.bin')
    expect(one.size).toBe(payload.length)
    expect(fs.readFileSync(path.join(dir(), one.file)).equals(payload)).toBe(true)

    const back = await fetch(`${base}/attachments/${one.file}`)
    expect(back.status).toBe(200)
    expect(Buffer.from(await back.arrayBuffer()).equals(payload)).toBe(true)
  })

  it('takes it over http and hands it back a piece at a time', async () => {
    const ui = await connect('sam')
    await raiseTo(ui, 25)

    const up = await post(base, payload, 'posted.bin')
    expect(up.status).toBe(200)
    const saved = (await up.json()) as { id: string; name: string; size: number; file: string }
    expect(saved.name).toBe('posted.bin')
    expect(saved.size).toBe(payload.length)
    expect(fs.readFileSync(path.join(dir(), saved.file)).equals(payload)).toBe(true)

    const back = await fetch(`${base}/attachments/${saved.file}`)
    expect(back.status).toBe(200)
    expect(back.headers.get('transfer-encoding')).toBe('chunked')
    expect(Buffer.from(await back.arrayBuffer()).equals(payload)).toBe(true)
  })

  it('turns it away on both doors while it is over the limit', async () => {
    const ui = await connect('sam')
    expect(host.session.attachmentLimit()).toBe(attachmentBytes(DEFAULT_ATTACHMENT_MB))
    expect(payload.length).toBeGreaterThan(host.session.attachmentLimit())

    expect((await post(base, payload, 'posted.bin')).status).toBe(413)

    ui.send({
      type: 'chat.send',
      text: 'too big',
      mentions: [],
      attachments: [{ name: 'big.bin', mime: 'application/octet-stream', data: payload.toString('base64') }]
    })

    const seen = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    expect(seen.attachments ?? []).toHaveLength(0)
    expect(fs.readdirSync(dir())).toHaveLength(0)
  })
})
