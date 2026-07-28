import type { CrewHome } from './project'

export interface RecentJoin {
  folder: string
  name: string
  link: string
  joinedAt: number
}

export interface RecentProject {
  folder: string
  name: string
  home: CrewHome
  key: string
  openedAt: number
}
