import fs from 'node:fs'
import path from 'node:path'
import type { CrewHome } from '../shared/project'
import type { RecentJoin, RecentProject } from '../shared/recent'

export type SavedSession =
  | { mode: 'host'; folder: string; name: string; home: CrewHome; shared: boolean }
  | { mode: 'join'; folder: string; name: string; link: string }

interface SavedSessionData {
  active: SavedSession | null
  recentJoins: RecentJoin[]
  projects: RecentProject[]
}

const RECENT_LIMIT = 5
const PROJECT_LIMIT = 8

function homeFrom(value: unknown): CrewHome {
  return value === 'private' ? 'private' : 'folder'
}

// A session written before there was anywhere else for a crew to live is one
// that lives in the folder and is shared, which is what it did.
function sessionFrom(value: unknown): SavedSession | null {
  const saved = value as Partial<{
    mode: string
    folder: string
    name: string
    link: string
    home: unknown
    shared: unknown
  }> | null
  if (!saved || typeof saved.folder !== 'string' || typeof saved.name !== 'string') return null
  if (saved.mode === 'host') {
    return {
      mode: 'host',
      folder: saved.folder,
      name: saved.name,
      home: homeFrom(saved.home),
      shared: saved.shared !== false
    }
  }
  if (saved.mode === 'join' && typeof saved.link === 'string') {
    return { mode: 'join', folder: saved.folder, name: saved.name, link: saved.link }
  }
  return null
}

function recentFrom(value: unknown): RecentJoin | null {
  const recent = value as Partial<RecentJoin> | null
  if (
    !recent ||
    typeof recent.folder !== 'string' ||
    typeof recent.name !== 'string' ||
    typeof recent.link !== 'string' ||
    typeof recent.joinedAt !== 'number'
  ) {
    return null
  }
  return {
    folder: recent.folder,
    name: recent.name,
    link: recent.link,
    joinedAt: recent.joinedAt
  }
}

function projectFrom(value: unknown): RecentProject | null {
  const project = value as Partial<RecentProject> | null
  if (
    !project ||
    typeof project.folder !== 'string' ||
    typeof project.name !== 'string' ||
    typeof project.key !== 'string' ||
    typeof project.openedAt !== 'number'
  ) {
    return null
  }
  return {
    folder: project.folder,
    name: project.name,
    home: homeFrom(project.home),
    key: project.key,
    openedAt: project.openedAt
  }
}

export class SavedSessionStore {
  constructor(private file: string) {}

  load(): SavedSession | null {
    return this.read().active
  }

  recentJoins(): RecentJoin[] {
    return this.read().recentJoins
  }

  projects(): RecentProject[] {
    return this.read().projects
  }

  save(session: SavedSession): void {
    const data = this.read()
    const recentJoins =
      session.mode === 'join'
        ? [
            { folder: session.folder, name: session.name, link: session.link, joinedAt: Date.now() },
            ...data.recentJoins.filter(recent => recent.link !== session.link)
          ].slice(0, RECENT_LIMIT)
        : data.recentJoins
    this.write({ ...data, active: session, recentJoins })
  }

  remember(project: RecentProject): void {
    const data = this.read()
    const projects = [project, ...data.projects.filter(known => known.folder !== project.folder)].slice(
      0,
      PROJECT_LIMIT
    )
    this.write({ ...data, projects })
  }

  forget(folder: string): void {
    const data = this.read()
    this.write({ ...data, projects: data.projects.filter(project => project.folder !== folder) })
  }

  forgetJoin(link: string): void {
    const data = this.read()
    this.write({ ...data, recentJoins: data.recentJoins.filter(recent => recent.link !== link) })
  }

  clear(): void {
    const data = this.read()
    if (data.recentJoins.length === 0 && data.projects.length === 0) {
      fs.rmSync(this.file, { force: true })
      return
    }
    this.write({ ...data, active: null })
  }

  private read(): SavedSessionData {
    let parsed: unknown
    try {
      parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch {
      return { active: null, recentJoins: [], projects: [] }
    }
    const legacy = sessionFrom(parsed)
    if (legacy) {
      return {
        active: legacy,
        recentJoins:
          legacy.mode === 'join'
            ? [{ folder: legacy.folder, name: legacy.name, link: legacy.link, joinedAt: 0 }]
            : [],
        projects: []
      }
    }
    const data = parsed as Partial<{ active: unknown; recentJoins: unknown; projects: unknown }> | null
    if (!data) return { active: null, recentJoins: [], projects: [] }
    const recentJoins = Array.isArray(data.recentJoins)
      ? data.recentJoins.map(recentFrom).filter((recent): recent is RecentJoin => recent !== null).slice(0, RECENT_LIMIT)
      : []
    const projects = Array.isArray(data.projects)
      ? data.projects.map(projectFrom).filter((project): project is RecentProject => project !== null).slice(0, PROJECT_LIMIT)
      : []
    return { active: sessionFrom(data.active), recentJoins, projects }
  }

  private write(data: SavedSessionData): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
    fs.renameSync(tmp, this.file)
  }
}
