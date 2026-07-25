import fs from 'node:fs'
import path from 'node:path'
import type { RecentJoin } from '../shared/recent'

export type SavedSession =
  | { mode: 'host'; folder: string; name: string }
  | { mode: 'join'; folder: string; name: string; link: string }

interface SavedSessionData {
  active: SavedSession | null
  recentJoins: RecentJoin[]
}

const RECENT_LIMIT = 5

function sessionFrom(value: unknown): SavedSession | null {
  const saved = value as Partial<{ mode: string; folder: string; name: string; link: string }> | null
  if (!saved || typeof saved.folder !== 'string' || typeof saved.name !== 'string') return null
  if (saved.mode === 'host') return { mode: 'host', folder: saved.folder, name: saved.name }
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

export class SavedSessionStore {
  constructor(private file: string) {}

  load(): SavedSession | null {
    return this.read().active
  }

  recentJoins(): RecentJoin[] {
    return this.read().recentJoins
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
    this.write({ active: session, recentJoins })
  }

  clear(): void {
    const data = this.read()
    if (data.recentJoins.length === 0) {
      fs.rmSync(this.file, { force: true })
      return
    }
    this.write({ active: null, recentJoins: data.recentJoins })
  }

  private read(): SavedSessionData {
    let parsed: unknown
    try {
      parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch {
      return { active: null, recentJoins: [] }
    }
    const legacy = sessionFrom(parsed)
    if (legacy) {
      return {
        active: legacy,
        recentJoins:
          legacy.mode === 'join'
            ? [{ folder: legacy.folder, name: legacy.name, link: legacy.link, joinedAt: 0 }]
            : []
      }
    }
    const data = parsed as Partial<{ active: unknown; recentJoins: unknown }> | null
    if (!data) return { active: null, recentJoins: [] }
    const recentJoins = Array.isArray(data.recentJoins)
      ? data.recentJoins.map(recentFrom).filter((recent): recent is RecentJoin => recent !== null).slice(0, RECENT_LIMIT)
      : []
    return { active: sessionFrom(data.active), recentJoins }
  }

  private write(data: SavedSessionData): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
    fs.renameSync(tmp, this.file)
  }
}
