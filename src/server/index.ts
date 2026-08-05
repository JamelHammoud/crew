import { openDoor, type Door, type DoorOptions } from './door'
import type { CrewSession } from './session'

export interface CrewServer {
  session: CrewSession
  port: () => number
  close: () => Promise<void>
}

export { openDoor, Door, type DoorOptions }

export function createCrewServer(session: CrewSession, opts: DoorOptions = {}): Promise<CrewServer> {
  return openDoor(opts).then(door => {
    door.hold(session)
    return {
      session,
      port: () => door.port(),
      close: () => door.close()
    }
  })
}
