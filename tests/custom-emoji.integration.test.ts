import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import type { CustomEmoji } from '../src/shared/customEmoji'
import type { SessionEvent } from '../src/shared/events'
import type { ServerMessage } from '../src/shared/protocol'
import { messageReactionTarget } from '../src/shared/reactions'
import { CrewSession } from '../src/server/session'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'

type Set = Extract<ServerMessage, { type: 'emoji.set' }>
type Notice = Extract<ServerMessage, { type: 'notice' }>
type Reaction = Extract<SessionEvent, { kind: 'message.reaction' }>

const emojiOf = (msg: ServerMessage): CustomEmoji[] => (msg as Set).emoji

// A one pixel picture of each kind, which is all the host ever looks at: it
// keeps what it is handed and the browser is what draws it.
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAABzenr0AAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
  'base64'
)

const gif = (name: string) => ({
  type: 'emoji.add' as const,
  name,
  mime: 'image/gif',
  data: GIF.toString('base64')
})

const httpBase = (host: TestHost): string => host.url.replace(/^ws/, 'http').replace(/\/ws$/, '')

const emojiDir = (host: TestHost): string => path.join(host.repoPath, '.crew', 'emoji')

describe('custom emoji', () => {
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

  it('takes one from anybody here and hands it to everyone', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send(gif('  Party Parrot  '))
    const landed = await pat.waitFor(m => m.type === 'emoji.set' && emojiOf(m).length > 0)
    const [emoji] = emojiOf(landed)
    // The name is what somebody types to reach it, so what they meant is taken
    // rather than refused.
    expect(emoji).toMatchObject({ name: 'party_parrot', by: 'sam' })
    expect(emoji.file).toMatch(/\.gif$/)
    expect(fs.existsSync(path.join(emojiDir(host), emoji.file))).toBe(true)
    expect(host.session.snapshot().emoji).toHaveLength(1)

    // Everyone draws their own copy, read from the host.
    const res = await fetch(`${httpBase(host)}/emoji/${emoji.file}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/gif')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect((await res.arrayBuffer()).byteLength).toBe(GIF.length)
  })

  it('keeps a name to one picture, and says so rather than dropping it', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send(gif('ship'))
    await sam.waitFor(m => m.type === 'emoji.set' && emojiOf(m).length === 1)

    sam.send({ type: 'emoji.add', name: 'SHIP', mime: 'image/png', data: PNG.toString('base64') })
    const notice = (await sam.waitFor(m => m.type === 'notice')) as Notice
    expect(notice.text).toContain(':ship:')
    expect(host.session.snapshot().emoji).toHaveLength(1)
    // The second picture never reaches the disk, so nothing is left behind under
    // a name nobody can see.
    expect(fs.readdirSync(emojiDir(host))).toHaveLength(1)
  })

  it('reacts with one, and refuses a name nothing here answers to', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send(gif('shipit'))
    await sam.waitFor(m => m.type === 'emoji.set' && emojiOf(m).length === 1)

    sam.chat('landed it')
    const message = await pat.waitForEvent(e => e.kind === 'message' && e.text === 'landed it')
    const targetId = messageReactionTarget(message.id)

    pat.send({ type: 'chat.react', targetId, emoji: ':nobody:' })
    pat.send({ type: 'chat.react', targetId, emoji: ':shipit:' })
    const added = (await sam.waitForEvent(
      e => e.kind === 'message.reaction' && e.targetId === targetId && e.active
    )) as Reaction

    expect(added.emoji).toBe(':shipit:')
    // A reaction can never stand for a picture that was never there.
    expect(host.session.snapshot().events.filter(e => e.kind === 'message.reaction')).toHaveLength(1)
  })

  it('names one again without moving the picture', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send(gif('parrot'))
    const landed = await sam.waitFor(m => m.type === 'emoji.set' && emojiOf(m).length === 1)
    const [before] = emojiOf(landed)

    sam.send(gif('taken'))
    await sam.waitFor(m => m.type === 'emoji.set' && emojiOf(m).length === 2)

    // A name already answering to something is refused, so the pair stay apart.
    sam.send({ type: 'emoji.rename', emojiId: before.id, name: 'taken' })
    await sam.waitFor(m => m.type === 'notice')
    expect(host.session.snapshot().emoji?.find(e => e.id === before.id)?.name).toBe('parrot')

    pat.send({ type: 'emoji.rename', emojiId: before.id, name: 'Party Parrot' })
    const renamed = await pat.waitFor(m => m.type === 'emoji.set' && emojiOf(m).some(e => e.name === 'party_parrot'))
    const after = emojiOf(renamed).find(e => e.id === before.id)
    expect(after?.file).toBe(before.file)
  })

  it('takes one away for everyone, picture and all', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send(gif('gone'))
    const landed = await sam.waitFor(m => m.type === 'emoji.set' && emojiOf(m).length === 1)
    const [emoji] = emojiOf(landed)

    // Anyone here can take one off, the same as the music shelf.
    pat.send({ type: 'emoji.remove', emojiId: emoji.id })
    await sam.waitFor(m => m.type === 'emoji.set' && emojiOf(m).length === 0)
    await waitUntil(() => host.session.snapshot().emoji?.length === 0)
    expect(fs.existsSync(path.join(emojiDir(host), emoji.file))).toBe(false)
  })

  it('keeps them across a restart, and out of the chat', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send(gif('kept'))
    const landed = await sam.waitFor(m => m.type === 'emoji.set' && emojiOf(m).length === 1)
    const [emoji] = emojiOf(landed)

    const revived = new CrewSession(host.store)
    expect(revived.snapshot().emoji).toHaveLength(1)
    expect(revived.snapshot().emoji?.[0]).toMatchObject({ id: emoji.id, name: 'kept', by: 'sam' })
    // An emoji is a picture in the picker rather than a moment to scroll past, so
    // its events are folded off the snapshot the way the shelf's are.
    expect(revived.snapshot().events.some(e => e.kind.startsWith('emoji.'))).toBe(false)

    // One whose picture has gone is left out rather than handed over as a name
    // that draws nothing.
    fs.rmSync(path.join(emojiDir(host), emoji.file))
    expect(new CrewSession(host.store).snapshot().emoji).toHaveLength(0)
  })

  it('turns away what it cannot draw', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    const data = GIF.toString('base64')
    sam.send({ type: 'emoji.add', name: 'slides', mime: 'application/pdf', data })
    sam.send({ type: 'emoji.add', name: 'empty', mime: 'image/gif', data: '' })
    sam.send({ type: 'emoji.add', name: '   ', mime: 'image/gif', data })
    // Nothing but punctuation is nothing, since the name is the whole of what
    // somebody types to reach it.
    sam.send({ type: 'emoji.add', name: '---', mime: 'image/gif', data })
    sam.send({ type: 'emoji.add', name: '🎉', mime: 'image/gif', data })
    sam.send({
      type: 'emoji.add',
      name: 'huge',
      mime: 'image/gif',
      data: Buffer.alloc(1024 * 1024 + 1).toString('base64')
    })
    await new Promise(r => setTimeout(r, 250))
    expect(sam.messages.some(m => m.type === 'emoji.set')).toBe(false)
    expect(host.session.snapshot().emoji).toHaveLength(0)
    expect(fs.readdirSync(emojiDir(host))).toHaveLength(0)
  })

  // They are the crew's own, the way the shelf and the leaderboard are. An
  // agent's machine is connected the whole time it is joined.
  it('leaves them to the crew rather than to a runner', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send(gif('mine'))
    const landed = await sam.waitFor(m => m.type === 'emoji.set' && emojiOf(m).length === 1)
    const [emoji] = emojiOf(landed)

    const runner = new WebSocket(host.url)
    await new Promise<void>(resolve => {
      runner.on('open', () => {
        runner.send(JSON.stringify({ type: 'hello', role: 'runner', name: 'mac', code: host.code, llms: [] }))
        resolve()
      })
    })
    runner.send(JSON.stringify({ type: 'emoji.add', name: 'theirs', mime: 'image/gif', data: GIF.toString('base64') }))
    runner.send(JSON.stringify({ type: 'emoji.rename', emojiId: emoji.id, name: 'yours' }))
    runner.send(JSON.stringify({ type: 'emoji.remove', emojiId: emoji.id }))
    await new Promise(r => setTimeout(r, 250))
    runner.close()

    expect(host.session.snapshot().emoji).toHaveLength(1)
    expect(host.session.snapshot().emoji?.[0]).toMatchObject({ id: emoji.id, name: 'mine' })
  })

  it('serves nothing for a name that is not one of its own', async () => {
    const base = httpBase(host)
    for (const name of ['../session.json', 'nope.gif', 'a/b.gif', 'x.svg']) {
      const res = await fetch(`${base}/emoji/${encodeURIComponent(name)}`)
      expect(res.status).toBe(404)
    }
  })
})
