import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agentId } from '../src/shared/llm'
import type { SessionEvent } from '../src/shared/events'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, tmpDir, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

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

const PDF = Buffer.from('%PDF-1.4 hello')

const file = (name: string, mime: string, data: Buffer = PDF) => ({
  name,
  mime,
  data: data.toString('base64')
})

describe('attachments', () => {
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

  async function connectRunner(name: string, repoPath = host.repoPath, crewBase: string | null = repoPath) {
    const runner = testRunner({
      name,
      code: host.code,
      repoPath,
      crewBase,
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

  it('takes a pasted image over http and serves it back for docs', async () => {
    const base = host.url.replace(/^ws/, 'http').replace(/\/ws$/, '')

    const res = await fetch(`${base}/attachments`, {
      method: 'POST',
      headers: { 'content-type': 'image/png', 'x-attachment-name': encodeURIComponent('pasted shot.png') },
      body: PNG
    })
    expect(res.status).toBe(200)
    const saved = (await res.json()) as { id: string; name: string; mime: string; size: number; file: string }
    expect(saved.file).toBe(`${saved.id}.png`)
    expect(saved.name).toBe('pasted shot.png')
    expect(saved.size).toBe(PNG.length)

    const onDisk = path.join(host.repoPath, '.crew', 'attachments', saved.file)
    expect(fs.readFileSync(onDisk).equals(PNG)).toBe(true)

    const back = await fetch(`${base}/attachments/${saved.file}`)
    expect(back.status).toBe(200)
    expect(Buffer.from(await back.arrayBuffer()).equals(PNG)).toBe(true)
  })

  it('takes a pasted file of any kind and turns away one that is too big', async () => {
    const base = host.url.replace(/^ws/, 'http').replace(/\/ws$/, '')

    const doc = await fetch(`${base}/attachments`, {
      method: 'POST',
      headers: { 'content-type': 'application/pdf', 'x-attachment-name': encodeURIComponent('notes.pdf') },
      body: PDF
    })
    expect(doc.status).toBe(200)
    const saved = (await doc.json()) as { id: string; name: string; mime: string; file: string }
    expect(saved.file).toBe(`${saved.id}.pdf`)
    expect(saved.mime).toBe('application/pdf')

    const back = await fetch(`${base}/attachments/${saved.file}`)
    expect(back.headers.get('content-type')).toBe('application/pdf')
    expect(Buffer.from(await back.arrayBuffer()).equals(PDF)).toBe(true)

    const unnamed = await fetch(`${base}/attachments`, {
      method: 'POST',
      headers: { 'content-type': 'application/pdf' },
      body: PDF
    })
    const bare = (await unnamed.json()) as { id: string; name: string; file: string }
    expect(bare.file).toBe(`${bare.id}.pdf`)
    expect(bare.name).toBe('file')

    const tooBig = await fetch(`${base}/attachments`, {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: Buffer.alloc(11 * 1024 * 1024)
    })
    expect(tooBig.status).toBe(413)
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

  it('keeps a file beside an image and turns away only what is too big', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)

    ui.send({
      type: 'chat.send',
      text: 'files',
      mentions: [],
      attachments: [
        file('notes.pdf', 'application/pdf'),
        { name: 'huge.png', mime: 'image/png', data: Buffer.alloc(11 * 1024 * 1024).toString('base64') },
        image('fine.png')
      ]
    })

    const seen = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    expect(seen.attachments?.map(a => a.name)).toEqual(['notes.pdf', 'fine.png'])
    const [pdf] = seen.attachments!
    expect(pdf.mime).toBe('application/pdf')
    expect(pdf.size).toBe(PDF.length)
    expect(pdf.file).toBe(`${pdf.id}.pdf`)
    expect(fs.readFileSync(path.join(host.repoPath, '.crew', 'attachments', pdf.file)).equals(PDF)).toBe(true)
  })

  // A browser reports one type for a text file and another for the same one on
  // the next machine, and reports nothing at all for plenty of them, so the name
  // is what decides and the type recorded is the type that comes back.
  it('names a file by its own extension and serves it as what it is', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const base = host.url.replace(/^ws/, 'http').replace(/\/ws$/, '')

    ui.send({
      type: 'chat.send',
      text: 'all of it',
      mentions: [],
      attachments: [
        file('rows.csv', 'text/plain', Buffer.from('a,b\n1,2\n')),
        file('run.log', '', Buffer.from('started\n')),
        file('.zshrc', '', Buffer.from('export PATH\n')),
        file('main.tf', '', Buffer.from('resource {}\n')),
        file('shapes.sketch', 'application/octet-stream'),
        file('Makefile', '', Buffer.from('all:\n'))
      ]
    })

    const seen = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    const [csv, log, rc, tf, sketch, make] = seen.attachments!
    expect(csv.file.endsWith('.csv')).toBe(true)
    expect(csv.mime).toBe('text/csv')
    expect(log.mime).toBe('text/plain')
    expect(rc.mime).toBe('text/plain')
    expect(tf.mime).toBe('text/plain')
    expect(sketch.file.endsWith('.sketch')).toBe(true)
    expect(sketch.mime).toBe('application/octet-stream')
    expect(make.file.endsWith('.bin')).toBe(true)

    for (const attachment of [csv, log, rc, tf, sketch, make]) {
      const res = await fetch(`${base}/attachments/${attachment.file}`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe(attachment.mime)
    }
  })

  // An attachment is served from the host's own address, so anything a browser
  // would run there is handed over as words instead.
  it('hands over a page or a vector as text and never as itself', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const base = host.url.replace(/^ws/, 'http').replace(/\/ws$/, '')

    ui.send({
      type: 'chat.send',
      text: 'have a look',
      mentions: [],
      attachments: [
        file('page.html', 'text/html', Buffer.from('<script>alert(1)</script>')),
        file('mark.svg', 'image/svg+xml', Buffer.from('<svg onload="alert(1)"/>'))
      ]
    })

    const seen = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    for (const attachment of seen.attachments!) {
      expect(attachment.mime).toBe('text/plain')
      const res = await fetch(`${base}/attachments/${attachment.file}`)
      expect(res.headers.get('content-type')).toBe('text/plain')
    }
  })

  it('keeps a name that is a path out of the folder as a label and nothing else', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)

    ui.send({
      type: 'chat.send',
      text: 'sneaky',
      mentions: [],
      attachments: [file('../../session.json', 'application/json', Buffer.from('{}'))]
    })

    const seen = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    const [one] = seen.attachments!
    expect(one.file).toBe(`${one.id}.json`)
    expect(fs.existsSync(path.join(host.repoPath, '.crew', 'attachments', one.file))).toBe(true)
    expect(fs.readFileSync(path.join(host.repoPath, '.crew', 'session.json'), 'utf8')).not.toBe('{}')
  })

  it('gives the agent a path for a file and says which is which', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.send({
      type: 'chat.send',
      text: 'read these @Fake',
      mentions: [fake],
      attachments: [file('notes.pdf', 'application/pdf'), image()]
    })
    const sent = (await ui.waitForEvent(e => e.kind === 'message' && !!e.threadId)) as Message
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end')) as Ended

    const dir = path.join(host.repoPath, '.crew', 'attachments')
    const [pdf, png] = sent.attachments!
    expect(end.text).toContain('Images shared with this message')
    expect(end.text).toContain('Files shared with this message')
    expect(end.text).toContain(path.join(dir, pdf.file))
    expect(end.text).toContain(path.join(dir, png.file))
  })

  it('says a file is a file in what the next turn reads', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.send({
      type: 'chat.send',
      text: 'first @Fake',
      mentions: [fake],
      attachments: [file('notes.pdf', 'application/pdf')]
    })
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)

    ui.send({ type: 'chat.send', text: 'and now', mentions: [], threadId: started.threadId })
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended
    expect(end.text).toContain('[file: notes.pdf]')
    expect(end.text).not.toContain('[image: notes.pdf]')
  })
})
