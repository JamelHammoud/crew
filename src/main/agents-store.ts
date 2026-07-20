import fs from 'node:fs'
import path from 'node:path'
import type { AgentDef } from '../shared/llm'

export class AgentStore {
  constructor(private file: string) {}

  load(): AgentDef[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  save(defs: AgentDef[]): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(defs, null, 2))
    fs.renameSync(tmp, this.file)
  }
}
