import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CrewSession } from '../src/server/session'
import { Store } from '../src/server/store'
import type { ClientMessage, ServerMessage } from '../src/shared/protocol'
import { TYPING_TTL, type Typist, typingLine, typistsIn } from '../src/shared/typing'
import { startHost, TestUi, tmpDir, waitUntil, type TestHost } from './helpers/session'

type Room = Extract<ServerMessage, { type: 'typing.room' }>

const rooms = (ui: TestUi): Room[] => ui.messages.filter((m): m is Room => m.type === 'typing.room')
const latest = (ui: TestUi): Typist[] => rooms(ui).at(-1)?.typists ?? []
const names = (ui: TestUi): string[] => latest(ui).map(typist => typist.name)
const settle = () => new Promise(r => setTimeout(r, 300))

describe('the words about who is typing', () => {
  it('names one person, two people, and a crowd', () => {
    expect(typingLine(['Jamel'])).toBe('Jamel is typing')
    expect(typingLine(['Jamel', 'Ali'])).toBe('Jamel and Ali are typing')
    expect(typingLine(['Jamel', 'Ali', 'Sam'])).toBe('Jamel and 2 others are typing')
    expect(typingLine(['Jamel', 'Ali', 'Sam', 'Pat'])).toBe('Jamel and 3 others are typing')
  })

  it('leaves you out, and everyone writing somewhere else', () => {
    const typists: Typist[] = [
      { id: 'me', name: 'Ali' },
      { id: 'jamel', name: 'Jamel' },
      { id: 'sam', name: 'Sam', where: 'thread-1' }
    ]
    expect(typistsIn(typists, undefined, 'me').map(t => t.name)).toEqual(['Jamel'])
    expect(typistsIn(typists, 'thread-1', 'me').map(t => t.name)).toEqual(['Sam'])
    expect(typistsIn(typists, 'thread-2', 'me')).toEqual([])
  })
})

describe('typing', () => {
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

  async function open(name: string): Promise<TestUi> {
    const ui = await TestUi.connect(host.url, name, host.code)
    uis.push(ui)
    return ui
  }

  it('tells everyone who is writing, and where', async () => {
    const jamel = await open('jamel')
    const ali = await open('ali')

    jamel.send({ type: 'typing', on: true })
    await ali.waitFor(m => m.type === 'typing.room' && m.typists.length === 1)
    expect(names(ali)).toEqual(['jamel'])
    expect(latest(ali)[0].where).toBeUndefined()

    ali.send({ type: 'typing', where: 'thread-1', on: true })
    await jamel.waitFor(m => m.type === 'typing.room' && m.typists.some(t => t.where === 'thread-1'))
    expect(latest(jamel).find(t => t.name === 'ali')?.where).toBe('thread-1')
  })

  it('says it once however many keystrokes went into it', async () => {
    const jamel = await open('jamel')
    const ali = await open('ali')

    jamel.send({ type: 'typing', on: true })
    await ali.waitFor(m => m.type === 'typing.room')
    jamel.send({ type: 'typing', on: true })
    jamel.send({ type: 'typing', on: true })
    await settle()
    expect(rooms(ali)).toHaveLength(1)
  })

  it('stops when they say so, when they send, and when their window goes', async () => {
    const jamel = await open('jamel')
    const ali = await open('ali')

    jamel.send({ type: 'typing', on: true })
    await ali.waitFor(m => m.type === 'typing.room' && m.typists.length === 1)
    jamel.send({ type: 'typing', on: false })
    await ali.waitFor(m => m.type === 'typing.room' && m.typists.length === 0)

    jamel.send({ type: 'typing', on: true })
    await ali.waitFor(m => m.type === 'typing.room' && m.typists.length === 1)
    jamel.chat('there it is')
    await ali.waitFor(m => m.type === 'typing.room' && m.typists.length === 0, 5000)

    jamel.send({ type: 'typing', on: true })
    await ali.waitFor(m => m.type === 'typing.room' && m.typists.length === 1)
    jamel.close()
    await waitUntil(() => latest(ali).length === 0)
  })

  // A window that dies mid-word never says it stopped, so the host lets go of it
  // on its own rather than leaving somebody typing forever.
  it('lets go of a window that went quiet', async () => {
    const store = new Store(tmpDir('typing'))
    const session = new CrewSession(store)
    const seen: Typist[][] = []
    const heard = new Map<string, (raw: unknown) => void>()
    const ws = {
      readyState: 1,
      OPEN: 1,
      send: (raw: string) => {
        const msg = JSON.parse(raw) as ServerMessage
        if (msg.type === 'typing.room') seen.push(msg.typists)
      },
      on: (name: string, fn: (raw: unknown) => void) => heard.set(name, fn)
    } as unknown as Parameters<CrewSession['attach']>[0]
    const say = (msg: ClientMessage) => heard.get('message')?.(JSON.stringify(msg))

    session.attach(ws)
    say({ type: 'hello', role: 'ui', name: 'jamel', code: session.code })
    say({ type: 'typing', on: true })
    expect(seen.at(-1)).toHaveLength(1)
    await waitUntil(() => seen.at(-1)?.length === 0, TYPING_TTL + 2000)
  })

  it('never writes any of it down', async () => {
    const jamel = await open('jamel')
    const ali = await open('ali')
    jamel.send({ type: 'typing', on: true })
    await ali.waitFor(m => m.type === 'typing.room')
    jamel.send({ type: 'typing', on: false })
    await settle()
    expect(host.store.loadEvents().some(event => event.kind.includes('typing'))).toBe(false)
    expect(ali.events.some(event => event.kind.includes('typing'))).toBe(false)
  })
})
