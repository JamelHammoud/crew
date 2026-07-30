import type { CrewHome } from './project'

// Where you are. One shape for every session, so a crew of one and a crew of
// six are the same place with different answers to `shared`.
export interface CurrentSession {
  wsUrl: string
  name: string
  code: string
  link: string | null
  folder: string
  home: CrewHome
  shared: boolean
  synced: boolean
  hosting: boolean
  // The repo this crew is kept in, for one that is kept outside the project.
  crewRemote: string | null
}

// What opening a folder should do. Both are only ever asked the first time a
// project is opened, and remembered from then on.
export interface OpenOptions {
  home?: CrewHome
  share?: boolean
  // A crew of this machine's own, for somebody who has the project and not the
  // crew it names. It is that answer picked on purpose rather than fallen into,
  // so nothing here ever quietly starts a second crew under one name.
  own?: boolean
}

// What opening this folder would do before anything is opened, so the app only
// asks where a crew should live when there is no answer already.
export interface ProjectPlan {
  home: CrewHome
  tracked: boolean
  known: boolean
  // The crew this project names, and whether it is already on this machine. An
  // open that has to fetch one is the only open that can fail for want of it.
  crewRemote: string | null
  crewHere: boolean
}
