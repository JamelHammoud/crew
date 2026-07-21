import fs from 'node:fs'
import path from 'node:path'
import type { AgentDef } from '../shared/llm'

export class AgentStore {
  constructor(private file: string) {}

  // An empty result means "no saved agents", which callers treat as a fresh
  // machine and reseed with defaults. That must never destroy data: a file
  // that exists but cannot be read as a def list is moved aside first, so the
  // reseed cannot overwrite whatever it held.
  load(): AgentDef[] {
    let text: string
    try {
      text = fs.readFileSync(this.file, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return []
      this.quarantine()
      return []
    }
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed
    } catch {}
    this.quarantine()
    return []
  }

  private quarantine(): void {
    try {
      fs.renameSync(this.file, `${this.file}.corrupt-${Date.now()}`)
    } catch {}
  }

  save(defs: AgentDef[]): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(defs, null, 2))
    fs.renameSync(tmp, this.file)
  }
}
