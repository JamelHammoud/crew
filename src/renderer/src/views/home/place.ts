import { parseLink } from '../../../../shared/link'
import type { RecentJoin, RecentProject } from '../../../../shared/recent'

export interface Place {
  key: string
  at: number
  title: string
  line: string
  project: RecentProject | null
  join: RecentJoin | null
}

export function folderName(folder: string): string {
  return folder.split(/[\\/]/).filter(Boolean).at(-1) ?? folder
}

// Where a folder sits, said the way it is said in a terminal. Home is the one
// part of a path nobody reads, so it comes out as a tilde.
export function folderLine(folder: string): string {
  const short = folder.replace(/^\/(Users|home)\/[^/]+/, '~')
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
export function placesOf(projects: RecentProject[], joins: RecentJoin[]): Place[] {
  const fromProjects = projects.map<Place>(project => ({
    key: `project:${project.folder}`,
    at: project.openedAt,
    title: folderName(project.folder),
    line: folderLine(project.folder),
    project,
    join: null
  }))
  const fromJoins = joins.map<Place>(join => ({
    key: `join:${join.link}`,
    at: join.joinedAt,
    title: serverName(join.link),
    line: folderName(join.folder),
    project: null,
    join
  }))
  return [...fromProjects, ...fromJoins].sort((a, b) => b.at - a.at)
}
