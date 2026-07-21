import fs from 'node:fs'
import path from 'node:path'

export type SavedSession =
  | { mode: 'host'; folder: string; name: string }
  | { mode: 'join'; folder: string; name: string; link: string }

export class SavedSessionStore {
  constructor(private file: string) {}

  load(): SavedSession | null {
    let parsed: unknown
    try {
      parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch {
      return null
    }
    const saved = parsed as Partial<{ mode: string; folder: string; name: string; link: string }> | null
    if (!saved || typeof saved.folder !== 'string' || typeof saved.name !== 'string') return null
    if (saved.mode === 'host') return { mode: 'host', folder: saved.folder, name: saved.name }
    if (saved.mode === 'join' && typeof saved.link === 'string') {
      return { mode: 'join', folder: saved.folder, name: saved.name, link: saved.link }
    }
    return null
  }

  save(session: SavedSession): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(session, null, 2))
    fs.renameSync(tmp, this.file)
  }

  clear(): void {
    fs.rmSync(this.file, { force: true })
  }
}
