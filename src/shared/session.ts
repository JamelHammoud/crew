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
}

// What opening a folder should do. Both are only ever asked the first time a
// project is opened, and remembered from then on.
export interface OpenOptions {
  home?: CrewHome
  share?: boolean
}

// What opening this folder would do before anything is opened, so the app only
// asks where a crew should live when there is no answer already.
export interface ProjectPlan {
  home: CrewHome
  tracked: boolean
  known: boolean
}
