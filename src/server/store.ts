import fs from 'node:fs'
import path from 'node:path'
import { isAttachmentFile } from '../shared/attachments'
import type { SessionEvent } from '../shared/events'
import type { PooledAgent } from '../shared/llm'

export interface PersistedMember {
  id: string
  name: string
}

export interface PersistedSession {
  code: string
  createdAt: number
  members: PersistedMember[]
  agents: Array<Omit<PooledAgent, 'status' | 'runs'>>
}

const PAGE_NAME = /^[a-z0-9][a-z0-9-]*$/

export class Store {
  readonly root: string

  constructor(repoPath: string) {
    this.root = path.join(repoPath, '.crew')
    fs.mkdirSync(path.join(this.root, 'docs'), { recursive: true })
    fs.mkdirSync(path.join(this.root, 'attachments'), { recursive: true })
  }

  saveAttachment(file: string, data: Buffer): void {
    if (!isAttachmentFile(file)) throw new Error(`Bad attachment name: ${file}`)
    this.writeAtomic(path.join(this.root, 'attachments', file), data)
  }

  attachmentPath(file: string): string | null {
    if (!isAttachmentFile(file)) return null
    const full = path.join(this.root, 'attachments', file)
    return fs.existsSync(full) ? full : null
  }

  loadSession(): PersistedSession | null {
    try {
      return JSON.parse(fs.readFileSync(this.sessionPath(), 'utf8'))
    } catch {
      return null
    }
  }

  saveSession(session: PersistedSession): void {
    this.writeAtomic(this.sessionPath(), JSON.stringify(session, null, 2))
  }

  appendEvent(event: SessionEvent): void {
    fs.appendFileSync(path.join(this.root, 'chat.jsonl'), JSON.stringify(event) + '\n')
  }

  loadEvents(): SessionEvent[] {
    let raw: string
    try {
      raw = fs.readFileSync(path.join(this.root, 'chat.jsonl'), 'utf8')
    } catch {
      return []
    }
    const events: SessionEvent[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        events.push(JSON.parse(line))
      } catch {
        continue
      }
    }
    return events
  }

  loadDocs(): Record<string, string> {
    const docsDir = path.join(this.root, 'docs')
    const docs: Record<string, string> = {}
    for (const file of fs.readdirSync(docsDir)) {
      if (!file.endsWith('.md')) continue
      docs[file.slice(0, -3)] = fs.readFileSync(path.join(docsDir, file), 'utf8')
    }
    return docs
  }

  saveDoc(page: string, text: string): void {
    if (!PAGE_NAME.test(page)) throw new Error(`Bad page name: ${page}`)
    this.writeAtomic(path.join(this.root, 'docs', `${page}.md`), text)
  }

  private sessionPath(): string {
    return path.join(this.root, 'session.json')
  }

  private writeAtomic(file: string, contents: string | Buffer): void {
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, contents)
    fs.renameSync(tmp, file)
  }
}
