import { openDoor, type Door } from '../server/door'
import { portToAsk } from '../server/port'
import type { CrewSession } from '../server/session'

export const PREFERRED_PORT = 2739

export interface Seat {
  host: string
  port: number
  leave: () => Promise<void>
}

// Two doors on this machine, one for the crews that are shared and one for the
// crews that are not, and the code is what says which crew a caller is reaching.
// The port was the crew's before this, so it moved with the order projects
// happened to be opened in and a guest's link was good for one run. It is the
// machine's now, and the code is stable for the life of the crew, so a link
// somebody was sent stays a link.
//
// A private crew is never on the open door at all. That is the same guarantee it
// had when it held a listener of its own, kept by the bind rather than by a check
// on every socket, which is the one place this could have leaked.
export class Doors {
  private open: Door | null = null
  private house: Door | null = null
  private queue: Promise<unknown> = Promise.resolve()

  seat(session: CrewSession, shared: boolean): Promise<Seat> {
    return this.inTurn(async () => {
      const door = await this.standing(shared)
      if (door.hold(session)) return this.seatOn(door, session, shared)
      // A code two crews answer to is the one thing a door refuses, so that crew
      // stands on a door of its own rather than being answered for by another.
      const alone = await openDoor({ host: shared ? '0.0.0.0' : '127.0.0.1', port: 0 })
      alone.hold(session)
      return { host: alone.host(), port: alone.port(), leave: () => alone.close() }
    })
  }

  closed(): boolean {
    return !this.open && !this.house
  }

  async shutdown(): Promise<void> {
    await this.inTurn(async () => {
      await this.open?.close()
      await this.house?.close()
      this.open = null
      this.house = null
    })
  }

  private seatOn(door: Door, session: CrewSession, shared: boolean): Seat {
    return {
      host: door.host(),
      port: door.port(),
      leave: () =>
        this.inTurn(async () => {
          door.drop(session)
          if (door.count() > 0) return
          await door.close()
          if (shared && this.open === door) this.open = null
          if (!shared && this.house === door) this.house = null
        })
    }
  }

  // Only the open door asks for the preferred port, because it is the only one a
  // link is ever written from. Another Crew already answering there is a second
  // app on this machine, and that one takes a port of its own the way every crew
  // used to, which is the one case a guest's address still moves.
  private async standing(shared: boolean): Promise<Door> {
    const held = shared ? this.open : this.house
    if (held) return held
    const door = shared
      ? await openDoor({ host: '0.0.0.0', port: await portToAsk(PREFERRED_PORT) })
      : await openDoor({ host: '127.0.0.1', port: 0 })
    if (shared) this.open = door
    else this.house = door
    return door
  }

  private inTurn<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work)
    this.queue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }
}
