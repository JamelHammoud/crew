import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { trackAfter, type MusicPlaylist } from '../src/shared/music'
import type { ServerMessage } from '../src/shared/protocol'
import { CrewSession } from '../src/server/session'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'

type Lists = Extract<ServerMessage, { type: 'music.playlists' }>
type Room = Extract<ServerMessage, { type: 'music.room' }>
type Shelf = Extract<ServerMessage, { type: 'music.shelf' }>

const listsOf = (msg: ServerMessage): MusicPlaylist[] => (msg as Lists).playlists
const roomOf = (msg: ServerMessage): Room['room'] => (msg as Room).room

const named = (msg: ServerMessage, name: string): MusicPlaylist | undefined =>
  listsOf(msg).find(one => one.name === name)

// A second of quiet, as a file the host accepts, for the one thing here that
// needs a track of the crew's own rather than one of the app's.
const wavBytes = (): Buffer => {
  const rate = 8000
  const frames = rate
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

// A list somebody made out of what is already on the shelf. Everyone sees every
// list and everyone can play one, and only whoever wrote it can write in it.
describe('playlists', () => {
  let host: TestHost
  let uis: TestUi[] = []

  const madeBy = async (ui: TestUi, name: string): Promise<MusicPlaylist> => {
    ui.send({ type: 'playlist.add', name })
    const landed = await ui.waitFor(m => m.type === 'music.playlists' && named(m, name) !== undefined)
    return named(landed, name) as MusicPlaylist
  }

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    uis = []
    await host.close()
  })

  it('is one persons list and everyones to play', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send({ type: 'playlist.add', name: '   Long   Drive  ' })
    const seen = await pat.waitFor(m => m.type === 'music.playlists' && listsOf(m).length === 1)
    const [list] = listsOf(seen)
    // The name is the name that was typed, with the spare spaces taken out of it.
    expect(list).toMatchObject({ name: 'Long Drive', by: 'sam', trackIds: [] })

    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: 'arcade', on: true })
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: 'hearth', on: true })
    const filled = await pat.waitFor(m => m.type === 'music.playlists' && listsOf(m)[0]?.trackIds.length === 2)
    // A list is the order it was written in.
    expect(listsOf(filled)[0].trackIds).toEqual(['arcade', 'hearth'])

    // Somebody else can put it on, and what is playing says which list it came
    // from, so everyone here is playing through the same one.
    pat.send({ type: 'music.set', trackId: 'arcade', playing: true, at: 0, playlistId: list.id })
    const playing = await sam.waitFor(m => m.type === 'music.room' && roomOf(m).trackId === 'arcade')
    expect(roomOf(playing)).toMatchObject({ playlistId: list.id, by: 'pat', playing: true })

    // And someone who comes late lands in the same list.
    const late = await TestUi.connect(host.url, 'jo', host.code)
    uis.push(late)
    const welcome = await late.waitFor(m => m.type === 'welcome')
    const snapshot = welcome.type === 'welcome' ? welcome.snapshot : null
    expect(snapshot?.music?.playlistId).toBe(list.id)
    expect(snapshot?.musicPlaylists?.[0]).toMatchObject({ name: 'Long Drive', trackIds: ['arcade', 'hearth'] })
  })

  it('lets nobody but its owner write in it', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    const mine = await madeBy(sam, 'Mine')
    sam.send({ type: 'playlist.track', playlistId: mine.id, trackId: 'arcade', on: true })
    await pat.waitFor(m => m.type === 'music.playlists' && listsOf(m)[0]?.trackIds.length === 1)

    // Somebody else adding, taking out, or deleting it does nothing at all.
    pat.send({ type: 'playlist.track', playlistId: mine.id, trackId: 'sprint', on: true })
    pat.send({ type: 'playlist.track', playlistId: mine.id, trackId: 'arcade', on: false })
    pat.send({ type: 'playlist.remove', playlistId: mine.id })
    await new Promise(r => setTimeout(r, 250))
    expect(host.session.snapshot().musicPlaylists?.[0]).toMatchObject({ name: 'Mine', trackIds: ['arcade'] })

    // Whoever wrote it can do all three.
    sam.send({ type: 'playlist.track', playlistId: mine.id, trackId: 'arcade', on: false })
    await waitUntil(() => host.session.snapshot().musicPlaylists?.[0].trackIds.length === 0)
    sam.send({ type: 'playlist.remove', playlistId: mine.id })
    const gone = await pat.waitFor(m => m.type === 'music.playlists' && listsOf(m).length === 0)
    expect(listsOf(gone)).toEqual([])

    // A list each, and neither one is in the other's way.
    const hers = await madeBy(pat, 'Hers')
    const his = await madeBy(sam, 'His')
    expect(hers.by).toBe('pat')
    expect(his.by).toBe('sam')
    const both = host.session.snapshot().musicPlaylists ?? []
    expect(both.map(one => one.by).sort()).toEqual(['pat', 'sam'])
  })

  // What a playlist is for. Next walks along the list it was put on from rather
  // than falling back into the shelf after its first track.
  it('plays through the list it was put on from', () => {
    const list: MusicPlaylist = { id: 'l1', name: 'Three', by: 'sam', trackIds: ['sprint', 'hearth', 'lobby'], ts: 0 }

    expect(trackAfter('sprint', 1, [], list)).toBe('hearth')
    expect(trackAfter('hearth', -1, [], list)).toBe('sprint')
    // A loop has no end to fall off, and neither has a list.
    expect(trackAfter('lobby', 1, [], list)).toBe('sprint')
    expect(trackAfter('sprint', -1, [], list)).toBe('lobby')
    // Off the list entirely, and the next thing is the top of it.
    expect(trackAfter('arcade', 1, [], list)).toBe('sprint')
    // With no list, the shelf itself is what is walked.
    expect(trackAfter('sprint', 1, [], null)).not.toBe('hearth')
    // An empty list is nothing to walk, so the shelf stands in rather than
    // Next doing nothing at all.
    const empty: MusicPlaylist = { ...list, trackIds: [] }
    expect(trackAfter(null, 1, [], empty)).toBeTruthy()
  })

  it('drops a track from every list when it leaves the shelf', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send({ type: 'music.add', name: 'Ours', mime: 'audio/wav', seconds: 8, data: wavBytes().toString('base64') })
    const shelf = (await sam.waitFor(m => m.type === 'music.shelf' && (m as Shelf).uploads.length > 0)) as Shelf
    const [upload] = shelf.uploads

    const list = await madeBy(sam, 'Both')
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: upload.id, on: true })
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: 'credits', on: true })
    await pat.waitFor(m => m.type === 'music.playlists' && listsOf(m)[0]?.trackIds.length === 2)

    // Anyone can take a track off the shelf, and a list holding it is read back
    // against what is really there rather than keeping a row that plays nothing.
    pat.send({ type: 'music.remove', trackId: upload.id })
    const left = await pat.waitFor(
      m => m.type === 'music.playlists' && listsOf(m)[0]?.trackIds.join() === 'credits'
    )
    expect(listsOf(left)[0].trackIds).toEqual(['credits'])
    expect(new CrewSession(host.store).snapshot().musicPlaylists?.[0].trackIds).toEqual(['credits'])
  })

  it('keeps the lists across a restart, and stays out of the chat', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    const list = await madeBy(sam, 'Kept')
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: 'star-road', on: true })
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: 'snowfield', on: true })
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: 'star-road', on: false })
    await sam.waitFor(m => m.type === 'music.playlists' && listsOf(m)[0]?.trackIds.length === 1)

    const dropped = await madeBy(sam, 'Dropped')
    sam.send({ type: 'playlist.remove', playlistId: dropped.id })
    await waitUntil(() => (host.session.snapshot().musicPlaylists ?? []).length === 1)

    // A list somebody wrote weeks ago is still a list, so it rides in the
    // snapshot and is read back from the log rather than scrolled past.
    const revived = new CrewSession(host.store).snapshot()
    expect(revived.musicPlaylists).toHaveLength(1)
    expect(revived.musicPlaylists?.[0]).toMatchObject({ name: 'Kept', by: 'sam', trackIds: ['snowfield'] })
    expect(revived.events.some(e => e.kind.startsWith('playlist.'))).toBe(false)
    expect(sam.events.some(e => e.kind.startsWith('playlist.'))).toBe(true)

    // What was playing from it is not written down, the way nothing about the
    // room ever is.
    expect(revived.music?.playlistId).toBe(null)
  })

  it('turns away what a list cannot hold', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    const list = await madeBy(sam, 'Careful')
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: 'polka', on: true })
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: '', on: true })
    sam.send({ type: 'playlist.track', playlistId: 'nobodys', trackId: 'arcade', on: true })
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: 'arcade', on: false })
    await new Promise(r => setTimeout(r, 250))
    expect(host.session.snapshot().musicPlaylists?.[0].trackIds).toEqual([])

    // A track already in a list stays where it is rather than jumping to the end.
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: 'arcade', on: true })
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: 'lobby', on: true })
    await sam.waitFor(m => m.type === 'music.playlists' && listsOf(m)[0]?.trackIds.length === 2)
    sam.send({ type: 'playlist.track', playlistId: list.id, trackId: 'arcade', on: true })
    await new Promise(r => setTimeout(r, 200))
    expect(host.session.snapshot().musicPlaylists?.[0].trackIds).toEqual(['arcade', 'lobby'])

    // Putting on a track from a list nobody has heard of plays the track and
    // belongs to no list, rather than being refused outright.
    sam.send({ type: 'music.set', trackId: 'arcade', playing: true, at: 0, playlistId: 'nobodys' })
    const playing = await sam.waitFor(m => m.type === 'music.room' && roomOf(m).trackId === 'arcade')
    expect(roomOf(playing).playlistId).toBe(null)

    // And deleting the list that is playing leaves the track on with no list
    // behind it.
    sam.send({ type: 'music.set', trackId: 'arcade', playing: true, at: 0, playlistId: list.id })
    await waitUntil(() => host.session.snapshot().music?.playlistId === list.id)
    sam.send({ type: 'playlist.remove', playlistId: list.id })
    await waitUntil(() => (host.session.snapshot().musicPlaylists ?? []).length === 0)
    expect(host.session.snapshot().music?.trackId).toBe('arcade')
    expect(host.session.snapshot().music?.playlistId).toBe(null)
  })

  // The lists belong to the people here. An agent's machine is connected the
  // whole time it is joined, and nothing it says writes one.
  it('leaves the lists to the crew rather than to a runner', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    const list = await madeBy(sam, 'Ours')

    const runner = new WebSocket(host.url)
    await new Promise<void>(resolve => {
      runner.on('open', () => {
        runner.send(JSON.stringify({ type: 'hello', role: 'runner', name: 'mac', code: host.code, llms: [] }))
        resolve()
      })
    })
    runner.send(JSON.stringify({ type: 'playlist.add', name: 'Theirs' }))
    runner.send(JSON.stringify({ type: 'playlist.track', playlistId: list.id, trackId: 'arcade', on: true }))
    runner.send(JSON.stringify({ type: 'playlist.remove', playlistId: list.id }))
    await new Promise(r => setTimeout(r, 250))
    runner.close()

    const held = host.session.snapshot().musicPlaylists ?? []
    expect(held).toHaveLength(1)
    expect(held[0]).toMatchObject({ name: 'Ours', trackIds: [] })
  })
})
