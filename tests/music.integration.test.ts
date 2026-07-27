import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import type { ServerMessage } from '../src/shared/protocol'
import { CrewSession } from '../src/server/session'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'

type Room = Extract<ServerMessage, { type: 'music.room' }>
type Shelf = Extract<ServerMessage, { type: 'music.shelf' }>

const roomOf = (msg: ServerMessage): Room['room'] => (msg as Room).room

// A second of quiet, as a file the browser and the host both accept.
const wavBytes = (seconds: number): Buffer => {
  const rate = 8000
  const frames = rate * seconds
  const out = Buffer.alloc(44 + frames * 2)
  out.write('RIFF', 0)
  out.writeUInt32LE(36 + frames * 2, 4)
  out.write('WAVEfmt ', 8)
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20)
  out.writeUInt16LE(1, 22)
  out.writeUInt32LE(rate, 24)
  out.writeUInt32LE(rate * 2, 28)
  out.writeUInt16LE(2, 32)
  out.writeUInt16LE(16, 34)
  out.write('data', 36)
  out.writeUInt32LE(frames * 2, 40)
  return out
}

describe('music', () => {
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

  it('puts a track on for everyone, and lets anyone else take the controls', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send({ type: 'music.set', trackId: 'overworld', playing: true, at: 0 })
    const heard = await pat.waitFor(m => m.type === 'music.room' && roomOf(m).trackId === 'overworld')
    expect(roomOf(heard)).toMatchObject({ trackId: 'overworld', playing: true, by: 'sam' })

    // Anyone can pause it, and it is paused for everyone.
    pat.send({ type: 'music.set', trackId: 'overworld', playing: false, at: 4 })
    const paused = await sam.waitFor(m => m.type === 'music.room' && !roomOf(m).playing)
    expect(roomOf(paused)).toMatchObject({ playing: false, by: 'pat' })
    expect(roomOf(paused).at).toBeCloseTo(4, 1)

    // And anyone can take it off.
    pat.send({ type: 'music.off' })
    const off = await sam.waitFor(m => m.type === 'music.room' && roomOf(m).trackId === null)
    expect(roomOf(off)).toMatchObject({ trackId: null, playing: false })
  })

  it('keeps its own time, so someone who comes late lands in step', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send({ type: 'music.set', trackId: 'overworld', playing: true, at: 0 })
    await sam.waitFor(m => m.type === 'music.room')
    await new Promise(r => setTimeout(r, 400))

    const late = await TestUi.connect(host.url, 'jo', host.code)
    uis.push(late)
    const welcome = await late.waitFor(m => m.type === 'welcome')
    const room = welcome.type === 'welcome' ? welcome.snapshot.music : null
    expect(room?.trackId).toBe('overworld')
    expect(room?.playing).toBe(true)
    expect(room?.at ?? 0).toBeGreaterThan(0.2)

    // A paused loop stays where it was left however long ago that was.
    sam.send({ type: 'music.set', trackId: 'overworld', playing: false, at: 5 })
    await late.waitFor(m => m.type === 'music.room' && !roomOf(m).playing)
    await new Promise(r => setTimeout(r, 300))
    expect(host.session.snapshot().music?.at).toBeCloseTo(5, 1)
  })

  // The whole point of it being in the snapshot rather than the log: nobody has
  // to scroll past a morning of somebody skipping tracks.
  it('never writes down what is playing', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send({ type: 'music.set', trackId: 'arcade', playing: true, at: 0 })
    await sam.waitFor(m => m.type === 'music.room' && roomOf(m).trackId === 'arcade')
    sam.send({ type: 'music.set', trackId: 'sprint', playing: true, at: 0 })
    await sam.waitFor(m => m.type === 'music.room' && roomOf(m).trackId === 'sprint')

    expect(sam.events.some(e => e.kind.startsWith('music.'))).toBe(false)
    expect(host.session.snapshot().events.some(e => e.kind.startsWith('music.'))).toBe(false)
    const log = path.join(host.repoPath, '.crew', 'chat.jsonl')
    const written = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : ''
    expect(written).not.toContain('sprint')

    // And a session coming back up has nothing on, rather than a track it
    // thinks has been playing since yesterday.
    expect(new CrewSession(host.store).snapshot().music?.trackId).toBe(null)
  })

  it('turns away a track nobody has heard of', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send({ type: 'music.set', trackId: 'polka', playing: true, at: 0 })
    sam.send({ type: 'music.set', trackId: '', playing: true, at: 0 })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.messages.some(m => m.type === 'music.room')).toBe(false)
    expect(host.session.snapshot().music?.trackId).toBe(null)
  })

  it('takes a track from the crew, and hands it to everyone', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send({
      type: 'music.add',
      name: '  Long Drive.mp3  ',
      mime: 'audio/wav',
      seconds: 12,
      data: wavBytes(1).toString('base64')
    })
    const shelf = (await pat.waitFor(m => m.type === 'music.shelf' && (m as Shelf).uploads.length > 0)) as Shelf
    expect(shelf.uploads).toHaveLength(1)
    const [upload] = shelf.uploads
    // The name it is filed under is the name it was given, without the part
    // that is only there to tell a computer what kind of file it is.
    expect(upload).toMatchObject({ name: 'Long Drive', seconds: 12, by: 'sam' })
    expect(upload.file).toMatch(/\.wav$/)
    expect(fs.existsSync(path.join(host.repoPath, '.crew', 'music', upload.file))).toBe(true)

    // Everyone plays their own copy, fetched from the host.
    const base = host.url.replace(/^ws/, 'http').replace(/\/ws$/, '')
    const res = await fetch(`${base}/music/${upload.file}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/wav')
    expect((await res.arrayBuffer()).byteLength).toBe(wavBytes(1).length)

    // A track is read with fetch rather than drawn by a tag, and a fetch is only
    // handed to the page when the host says who may read it. Without this the
    // app served on a port of its own hears nothing at all, and says nothing
    // either, which is what happened.
    expect(res.headers.get('access-control-allow-origin')).toBe('*')

    // And it can be put on the way anything else can.
    pat.send({ type: 'music.set', trackId: upload.id, playing: true, at: 0 })
    const playing = await sam.waitFor(m => m.type === 'music.room' && roomOf(m).trackId === upload.id)
    expect(roomOf(playing).playing).toBe(true)
  })

  it('keeps the shelf across a restart, and the room out of it', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send({ type: 'music.add', name: 'Demo', mime: 'audio/wav', seconds: 8, data: wavBytes(1).toString('base64') })
    const shelf = (await sam.waitFor(m => m.type === 'music.shelf' && (m as Shelf).uploads.length > 0)) as Shelf
    const [upload] = shelf.uploads

    const revived = new CrewSession(host.store)
    expect(revived.snapshot().musicUploads).toHaveLength(1)
    expect(revived.snapshot().musicUploads?.[0]).toMatchObject({ id: upload.id, name: 'Demo', seconds: 8 })
    expect(revived.snapshot().events.some(e => e.kind.startsWith('music.'))).toBe(false)
  })

  it('takes a track off the shelf, and stops it if it was the one playing', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send({ type: 'music.add', name: 'Gone', mime: 'audio/wav', seconds: 8, data: wavBytes(1).toString('base64') })
    const shelf = (await sam.waitFor(m => m.type === 'music.shelf' && (m as Shelf).uploads.length > 0)) as Shelf
    const [upload] = shelf.uploads
    sam.send({ type: 'music.set', trackId: upload.id, playing: true, at: 0 })
    await pat.waitFor(m => m.type === 'music.room' && roomOf(m).trackId === upload.id)

    pat.send({ type: 'music.remove', trackId: upload.id })
    // Nobody is left holding a place in something that is no longer there.
    const off = await sam.waitFor(m => m.type === 'music.room' && roomOf(m).trackId === null)
    expect(roomOf(off).playing).toBe(false)
    await waitUntil(() => host.session.snapshot().musicUploads?.length === 0)
    expect(fs.existsSync(path.join(host.repoPath, '.crew', 'music', upload.file))).toBe(false)

    // A track whose file has gone is left off the shelf on the way back up.
    expect(new CrewSession(host.store).snapshot().musicUploads).toHaveLength(0)
  })

  it('turns away a file it cannot play', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    const data = wavBytes(1).toString('base64')
    sam.send({ type: 'music.add', name: 'Slides', mime: 'application/pdf', seconds: 8, data })
    sam.send({ type: 'music.add', name: 'Empty', mime: 'audio/wav', seconds: 8, data: '' })
    sam.send({ type: 'music.add', name: 'Endless', mime: 'audio/wav', seconds: 60 * 60 * 5, data })
    sam.send({ type: 'music.add', name: 'Instant', mime: 'audio/wav', seconds: 0, data })
    await new Promise(r => setTimeout(r, 250))
    expect(sam.messages.some(m => m.type === 'music.shelf')).toBe(false)
    expect(host.session.snapshot().musicUploads).toHaveLength(0)
    expect(fs.readdirSync(path.join(host.repoPath, '.crew', 'music'))).toHaveLength(0)
  })

  // The controls belong to the people here. An agent's machine is connected the
  // whole time it is joined, and nothing it says moves what the crew is playing.
  it('leaves the controls to the crew rather than to a runner', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send({ type: 'music.set', trackId: 'lobby', playing: true, at: 0 })
    await sam.waitFor(m => m.type === 'music.room')

    const runner = new WebSocket(host.url)
    await new Promise<void>(resolve => {
      runner.on('open', () => {
        runner.send(JSON.stringify({ type: 'hello', role: 'runner', name: 'mac', code: host.code, llms: [] }))
        resolve()
      })
    })
    runner.send(JSON.stringify({ type: 'music.off' }))
    runner.send(JSON.stringify({ type: 'music.set', trackId: 'boss-fight', playing: true, at: 0 }))
    await new Promise(r => setTimeout(r, 250))
    runner.close()
    expect(host.session.snapshot().music?.trackId).toBe('lobby')
  })
})
