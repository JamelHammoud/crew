import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { attachmentBytes, httpBaseFrom, MAX_ATTACHMENTS } from '../src/shared/attachments'
import { filesFrom, readFiles } from '../src/renderer/src/components/images'
import { keepPreviews, pendingUrl, previewSrc } from '../src/renderer/src/components/attachment/pending'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Message = Extract<SessionEvent, { kind: 'message' }>

const BIG = 10_000_000
const WIDE = 2100
const TALL = 1600

interface Page {
  File: typeof File
  FileReader: typeof FileReader
  Blob: typeof Blob
}

const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string) => { window: Page }
}

const page: Page = new JSDOM('').window

const bytes = (size: number): Uint8Array => {
  const made = new Uint8Array(size)
  for (let at = 0; at < size; at += 1) made[at] = (at * 31 + 7) % 256
  return made
}

const fileOf = (name: string, mime: string, size = BIG): File => new page.File([bytes(size)], name, { type: mime })

let painted: Array<{ width: number; height: number }> = []
let handed: string[] = []
let revoked: string[] = []
let sources = new Map<string, Blob>()
let readers = 0
let decoded = 0

class CountingFileReader extends page.FileReader {
  constructor() {
    super()
    readers += 1
  }
}

class TestCanvas {
  constructor(
    public width: number,
    public height: number
  ) {}
  getContext(): { drawImage: () => void } {
    return { drawImage: () => {} }
  }
  convertToBlob(): Promise<Blob> {
    painted.push({ width: this.width, height: this.height })
    return Promise.resolve(new Blob([bytes(this.width * this.height)], { type: 'image/png' }))
  }
}

const bitmap = (width: number, height: number) => ({ width, height, close: () => {} })

beforeEach(() => {
  painted = []
  handed = []
  revoked = []
  sources = new Map()
  readers = 0
  decoded = 0
  globalThis.FileReader = CountingFileReader
  globalThis.Blob = page.Blob
  globalThis.OffscreenCanvas = TestCanvas as unknown as typeof OffscreenCanvas
  globalThis.createImageBitmap = ((_source: unknown, opts?: ImageBitmapOptions) => {
    decoded += 1
    if (opts?.resizeWidth && opts?.resizeHeight) return Promise.resolve(bitmap(opts.resizeWidth, opts.resizeHeight))
    return Promise.resolve(bitmap(WIDE, TALL))
  }) as unknown as typeof createImageBitmap
  URL.createObjectURL = (source: Blob): string => {
    const url = `blob:crew/${handed.length}`
    sources.set(url, source)
    handed.push(url)
    return url
  }
  URL.revokeObjectURL = (url: string): void => {
    revoked.push(url)
  }
})

afterEach(() => {
  keepPreviews(new Set())
})

describe('a picture waiting to be sent', () => {
  it('draws the tray a thumbnail at the size the tray shows it, not the whole file', async () => {
    const [item] = await readFiles([fileOf('photo.png', 'image/png')], 0)

    expect(painted).toEqual([{ width: 168, height: 128 }])
    expect(previewSrc(item!)).toMatch(/^blob:/)
    expect(previewSrc(item!).length).toBeLessThan(64)
  })

  it('keeps the shape of the picture, so the tray crops rather than squashes', async () => {
    await readFiles([fileOf('photo.png', 'image/png')], 0)

    const [{ width, height }] = painted
    expect(Math.min(width, height)).toBe(128)
    expect(width / height).toBeCloseTo(WIDE / TALL, 2)
  })

  it('opens the file itself rather than the thumbnail it drew for the tray', async () => {
    const [item] = await readFiles([fileOf('photo.png', 'image/png')], 0)

    const opened = pendingUrl(item!)
    expect(opened).not.toBe(previewSrc(item!))
    expect(sources.get(opened)!.size).toBe(BIG)
  })

  it('hands the same url back rather than making a second one for every render', async () => {
    const [item] = await readFiles([fileOf('photo.png', 'image/png')], 0)

    const first = previewSrc(item!)
    for (let at = 0; at < 50; at += 1) previewSrc(item!)
    const opened = pendingUrl(item!)
    for (let at = 0; at < 50; at += 1) pendingUrl(item!)

    expect(previewSrc(item!)).toBe(first)
    expect(handed).toEqual([first, opened])
  })

  it('never takes a still of a moving picture', async () => {
    const [item] = await readFiles([fileOf('moving.gif', 'image/gif', 400_000)], 0)

    expect(painted).toEqual([])
    expect(previewSrc(item!)).toBe(pendingUrl(item!))
    expect(sources.get(previewSrc(item!))!.size).toBe(400_000)
  })
})

describe('a file waiting to be sent', () => {
  it('opens from the file itself rather than by unpacking the text it was read into', async () => {
    const seen: string[] = []
    const decode = globalThis.atob
    globalThis.atob = (value: string): string => {
      seen.push('atob')
      return decode(value)
    }

    const [item] = await readFiles([fileOf('archive.zip', 'application/zip')], 0)
    const opened = pendingUrl(item!)
    globalThis.atob = decode

    expect(seen).toEqual([])
    expect(opened).toMatch(/^blob:/)
    expect(sources.get(opened)!.size).toBe(BIG)
    expect(painted).toEqual([])
  })
})

describe('what the tray lets go of', () => {
  it('gives every picture it made back once the message has gone', async () => {
    const [item] = await readFiles([fileOf('photo.png', 'image/png')], 0)
    previewSrc(item!)
    pendingUrl(item!)

    keepPreviews(new Set())

    expect(handed).toHaveLength(2)
    expect(revoked.sort()).toEqual([...handed].sort())
  })

  it('keeps the ones still waiting in the tray', async () => {
    const read = await readFiles([fileOf('one.png', 'image/png'), fileOf('two.png', 'image/png')], 0)
    for (const item of read) previewSrc(item)

    keepPreviews(new Set([read[0]!.id]))

    expect(revoked).toHaveLength(1)
    expect(previewSrc(read[0]!)).toBe(handed[0])
  })
})

describe('the limits', () => {
  it('turns away a file over the limit before a byte of it is read', async () => {
    const over = filesFrom([fileOf('huge.zip', 'application/zip', BIG + 1)], attachmentBytes(10))

    expect(over).toEqual([])
    expect(readers).toBe(0)
  })

  it('stops at six before it reads the seventh', async () => {
    const many = Array.from({ length: 9 }, (_, at) => fileOf(`f${at}.zip`, 'application/zip', 2_000))

    const read = await readFiles(many, 0)

    expect(read).toHaveLength(MAX_ATTACHMENTS)
    expect(readers).toBe(MAX_ATTACHMENTS)
  })

  it('counts what is already in the tray against the six', async () => {
    const many = Array.from({ length: 4 }, (_, at) => fileOf(`f${at}.zip`, 'application/zip', 2_000))

    const read = await readFiles(many, 4)

    expect(read).toHaveLength(2)
    expect(readers).toBe(2)
  })

  it('draws no thumbnail for a file it is never going to read', async () => {
    const many = Array.from({ length: 9 }, (_, at) => fileOf(`f${at}.png`, 'image/png', 2_000))

    await readFiles(many, 0)

    expect(painted).toHaveLength(MAX_ATTACHMENTS)
    expect(decoded).toBe(MAX_ATTACHMENTS * 2)
  })
})

describe('ten megabytes through a real session', () => {
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

  it('lands on the host byte for byte and comes back the same way', async () => {
    const raw = bytes(BIG)
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)

    const [item] = await readFiles([new page.File([raw], 'archive.zip', { type: 'application/zip' })], 0)
    expect(item!.size).toBe(BIG)
    ui.send({
      type: 'chat.send',
      text: 'here it is',
      mentions: [],
      attachments: [{ name: item!.name, mime: item!.mime, data: item!.data }]
    })

    const seen = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    const [saved] = seen.attachments!
    expect(saved.size).toBe(BIG)

    const onDisk = fs.readFileSync(path.join(host.repoPath, '.crew', 'attachments', saved.file))
    expect(onDisk.equals(Buffer.from(raw))).toBe(true)

    const res = await fetch(`${httpBaseFrom(host.url)}/attachments/${saved.file}`)
    expect(res.status).toBe(200)
    expect(Buffer.from(await res.arrayBuffer()).equals(Buffer.from(raw))).toBe(true)
  })

  it('carries a picture through the same way while the tray holds a thumbnail of it', async () => {
    const raw = bytes(BIG)
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)

    const [item] = await readFiles([new page.File([raw], 'photo.png', { type: 'image/png' })], 0)
    expect(painted).toEqual([{ width: 168, height: 128 }])
    ui.send({
      type: 'chat.send',
      text: 'look',
      mentions: [],
      attachments: [{ name: item!.name, mime: item!.mime, data: item!.data }]
    })

    const seen = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    const [saved] = seen.attachments!
    const onDisk = fs.readFileSync(path.join(host.repoPath, '.crew', 'attachments', saved.file))
    expect(onDisk.equals(Buffer.from(raw))).toBe(true)
  })
})
