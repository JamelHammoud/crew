import { parseLink } from '../../../../shared/link'
import { joinPlace, projectPlace } from '../../../../shared/places'
import type { RecentJoin, RecentProject } from '../../../../shared/recent'

export interface Place {
  key: string
  at: number
  title: string
  line: string
  given: string
  nickname: string | null
  project: RecentProject | null
  join: RecentJoin | null
}

export function folderName(folder: string): string {
  return folder.split(/[\\/]/).filter(Boolean).at(-1) ?? folder
}

export function folderPath(folder: string): string {
  return folder.replace(/^\/(Users|home)\/[^/]+/, '~')
}

// Where a folder sits, said the way it is said in a terminal. Home is the one
// part of a path nobody reads, so it comes out as a tilde.
export function folderLine(folder: string): string {
  const short = folderPath(folder)
  const parts = short.split(/[\\/]/).filter(Boolean)
  return parts.slice(0, -1).join('/') || short
}

function serverName(link: string): string {
  try {
    const target = parseLink(link)
    return `${target.host}:${target.port}`
  } catch {
    return link
  }
}

// Everywhere you can be, newest first. A project of your own and a session
// somebody invited you to stand in one list, because picking one is the same
// choice.
export function placesOf(projects: RecentProject[], joins: RecentJoin[], names: Record<string, string> = {}): Place[] {
  const fromProjects = projects.map<Place>(project => {
    const key = projectPlace(project.folder)
    const nickname = names[key] ?? null
    const given = folderName(project.folder)
    return {
      key,
      at: project.openedAt,
      title: nickname ?? given,
      line: nickname ? folderPath(project.folder) : folderLine(project.folder),
      given,
      nickname,
      project,
      join: null
    }
  })
  const fromJoins = joins.map<Place>(join => {
    const key = joinPlace(join.link)
    const nickname = names[key] ?? null
    const given = serverName(join.link)
    return {
      key,
      at: join.joinedAt,
      title: nickname ?? given,
      line: nickname ? given : folderName(join.folder),
      given,
      nickname,
      project: null,
      join
    }
  })
  return [...fromProjects, ...fromJoins].sort((a, b) => b.at - a.at)
}
