import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { Doors, type Seat } from '../src/main/doors'
import { openDoor, type Door } from '../src/server/door'
import { CrewSession } from '../src/server/session'
import { Store } from '../src/server/store'
import type { ServerMessage } from '../src/shared/protocol'
import { tmpDir } from './helpers/session'

function crew(name: string): CrewSession {
  return new CrewSession(new Store(tmpDir(`door-${name}`)))
}

function firstReply(url: string, code: string): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const timer = setTimeout(() => {
      ws.close()
      reject(new Error('nothing came back'))
    }, 5000)
    ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', role: 'ui', name: 'Jamel', code })))
    ws.on('message', raw => {
      clearTimeout(timer)
      ws.close()
      resolve(JSON.parse(raw.toString()) as ServerMessage)
    })
    ws.on('error', err => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

describe('one door in front of every crew', () => {
  const standing: Door[] = []

  afterEach(async () => {
    await Promise.all(standing.splice(0).map(door => door.close()))
  })

  async function doorWith(...sessions: CrewSession[]): Promise<Door> {
    const door = await openDoor({ port: 0, host: '127.0.0.1' })
    standing.push(door)
    for (const session of sessions) expect(door.hold(session)).toBe(true)
    return door
  }

  it('answers each crew on its own code at one port', async () => {
    const one = crew('one')
    const two = crew('two')
    const door = await doorWith(one, two)

    const first = await firstReply(`ws://127.0.0.1:${door.port()}/${one.code}/ws`, one.code)
    expect(first.type).toBe('welcome')
    const second = await firstReply(`ws://127.0.0.1:${door.port()}/${two.code}/ws`, two.code)
    expect(second.type).toBe('welcome')
  })

  it('turns away a code nobody here answers to', async () => {
    const one = crew('unknown-ws')
    const door = await doorWith(one)
    await expect(firstReply(`ws://127.0.0.1:${door.port()}/beef0000/ws`, one.code)).rejects.toThrow()
  })

  it('refuses a socket that names no crew at all', async () => {
    const one = crew('bare-ws')
    const door = await doorWith(one)
    await expect(firstReply(`ws://127.0.0.1:${door.port()}/ws`, one.code)).rejects.toThrow()
  })

  it('lands an http route on the crew its code names', async () => {
    const one = crew('http-one')
    const door = await doorWith(one)

    const mine = await fetch(`http://127.0.0.1:${door.port()}/${one.code}/memory`)
    expect(mine.status).toBe(400)
    const nobodys = await fetch(`http://127.0.0.1:${door.port()}/beef0000/memory`)
    expect(nobodys.status).toBe(404)
    const bare = await fetch(`http://127.0.0.1:${door.port()}/memory`)
    expect(bare.status).toBe(404)
  })

  it('says it is a crew at the root without naming one', async () => {
    await doorWith(crew('root'))
    const door = standing[standing.length - 1]
    const said = await fetch(`http://127.0.0.1:${door.port()}/`)
    expect(said.status).toBe(200)
    expect(await said.text()).toBe('crew')
  })

  it('holds one crew per code and lets the second one go elsewhere', async () => {
    const one = crew('twin-one')
    const two = crew('twin-two')
    two.code = one.code
    const door = await doorWith(one)
    expect(door.hold(two)).toBe(false)
    expect(door.count()).toBe(1)
  })

  it('stops answering for a crew that has left', async () => {
    const one = crew('leaver')
    const door = await doorWith(one)
    door.drop(one)
    expect(door.count()).toBe(0)
    await expect(firstReply(`ws://127.0.0.1:${door.port()}/${one.code}/ws`, one.code)).rejects.toThrow()
  })
})

describe('the doors this machine holds', () => {
  const held: Doors[] = []
  const seats: Seat[] = []

  afterEach(async () => {
    await Promise.all(seats.splice(0).map(seat => seat.leave()))
    await Promise.all(held.splice(0).map(doors => doors.shutdown()))
  })

  function machine(): Doors {
    const doors = new Doors()
    held.push(doors)
    return doors
  }

  async function seat(doors: Doors, session: CrewSession, shared: boolean): Promise<Seat> {
    const taken = await doors.seat(session, shared)
    seats.push(taken)
    return taken
  }

  it('stands every shared crew at one port', async () => {
    const doors = machine()
    const first = await seat(doors, crew('shared-one'), true)
    const second = await seat(doors, crew('shared-two'), true)
    expect(second.port).toBe(first.port)
    expect(first.host).toBe('0.0.0.0')
  })

  it('keeps a private crew off the door that answers the network', async () => {
    const doors = machine()
    const open = await seat(doors, crew('open'), true)
    const shut = await seat(doors, crew('shut'), false)
    expect(shut.port).not.toBe(open.port)
    expect(shut.host).toBe('127.0.0.1')
  })

  it('stands every private crew at one port too', async () => {
    const doors = machine()
    const first = await seat(doors, crew('private-one'), false)
    const second = await seat(doors, crew('private-two'), false)
    expect(second.port).toBe(first.port)
  })

  it('gives a crew whose code is already answered a door of its own', async () => {
    const doors = machine()
    const one = crew('same-one')
    const two = crew('same-two')
    two.code = one.code
    const first = await seat(doors, one, true)
    const second = await seat(doors, two, true)
    expect(second.port).not.toBe(first.port)
  })

  it('moves a crew between the two doors when it is shared', async () => {
    const doors = machine()
    const open = await seat(doors, crew('neighbour'), true)
    const session = crew('mover')
    const home = await doors.seat(session, false)
    expect(home.port).not.toBe(open.port)

    await home.leave()
    const away = await seat(doors, session, true)
    expect(away.port).toBe(open.port)

    const back = await firstReply(`ws://127.0.0.1:${away.port}/${session.code}/ws`, session.code)
    expect(back.type).toBe('welcome')
  })

  it('lets go of a door once the last crew on it has gone', async () => {
    const doors = machine()
    const one = await doors.seat(crew('last-one'), true)
    const two = await doors.seat(crew('last-two'), true)
    await one.leave()
    expect(doors.closed()).toBe(false)
    await two.leave()
    expect(doors.closed()).toBe(true)
  })
})
