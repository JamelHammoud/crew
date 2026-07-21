import fs from 'node:fs'
import path from 'node:path'
import { isAttachmentFile } from '../shared/attachments'
import { parseDocFile, serializeDocFile, type DocPage } from '../shared/docs'
import type { SessionEvent } from '../shared/events'
import type { PooledAgent } from '../shared/llm'
import { isStudioId, type StudioDoc } from '../shared/studio'

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

const PAGE_SEGMENT = '[a-z0-9][a-z0-9-]*'
const PAGE_NAME = new RegExp(`^${PAGE_SEGMENT}(/${PAGE_SEGMENT})*$`)

export class Store {
  readonly root: string

  constructor(repoPath: string) {
    this.root = path.join(repoPath, '.crew')
    fs.mkdirSync(path.join(this.root, 'docs'), { recursive: true })
    fs.mkdirSync(path.join(this.root, 'attachments'), { recursive: true })
    fs.mkdirSync(path.join(this.root, 'studio'), { recursive: true })
  }

  loadStudios(): StudioDoc[] {
    const dir = path.join(this.root, 'studio')
    let entries: string[]
    try {
      entries = fs.readdirSync(dir)
    } catch {
      return []
    }
    const docs: StudioDoc[] = []
    for (const name of entries) {
      if (!name.endsWith('.json')) continue
      try {
        const doc = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))
        if (doc && isStudioId(doc.id) && Array.isArray(doc.pages)) docs.push(doc)
      } catch {
        continue
      }
    }
    return docs
  }

  saveStudio(doc: StudioDoc): void {
    if (!isStudioId(doc.id)) throw new Error(`Bad studio id: ${doc.id}`)
    this.writeAtomic(path.join(this.root, 'studio', `${doc.id}.json`), JSON.stringify(doc))
  }

  deleteStudio(id: string): void {
    if (!isStudioId(id)) throw new Error(`Bad studio id: ${id}`)
    fs.rmSync(path.join(this.root, 'studio', `${id}.json`), { force: true })
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

  loadDocs(): Record<string, DocPage> {
    const docs: Record<string, DocPage> = {}
    const walk = (dir: string, prefix: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full, `${prefix}${entry.name}/`)
        } else if (entry.name.endsWith('.md')) {
          const page = `${prefix}${entry.name.slice(0, -3)}`
          docs[page] = parseDocFile(fs.readFileSync(full, 'utf8'), page)
        }
      }
    }
    walk(path.join(this.root, 'docs'), '')
    return docs
  }

  saveDoc(page: string, doc: DocPage): void {
    if (!PAGE_NAME.test(page)) throw new Error(`Bad page name: ${page}`)
    const file = path.join(this.root, 'docs', `${page}.md`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    this.writeAtomic(file, serializeDocFile(doc))
  }

  loadTitles(): Record<string, string> {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.titlesPath(), 'utf8'))
      const titles: Record<string, string> = {}
      for (const [page, title] of Object.entries(parsed)) {
        if (typeof title === 'string' && title) titles[page] = title
      }
      return titles
    } catch {
      return {}
    }
  }

  saveTitles(titles: Record<string, string>): void {
    const entries = Object.entries(titles).filter(([, title]) => title)
    if (entries.length === 0) {
      fs.rmSync(this.titlesPath(), { force: true })
      return
    }
    this.writeAtomic(this.titlesPath(), JSON.stringify(Object.fromEntries(entries), null, 2))
  }

  deleteDoc(page: string): void {
    if (!PAGE_NAME.test(page)) throw new Error(`Bad page name: ${page}`)
    const docsDir = path.join(this.root, 'docs')
    fs.rmSync(path.join(docsDir, `${page}.md`), { force: true })
    fs.rmSync(path.join(docsDir, page), { recursive: true, force: true })
  }

  renameDoc(from: string, to: string): void {
    if (!PAGE_NAME.test(from)) throw new Error(`Bad page name: ${from}`)
    if (!PAGE_NAME.test(to)) throw new Error(`Bad page name: ${to}`)
    const docsDir = path.join(this.root, 'docs')
    const sourceFile = path.join(docsDir, `${from}.md`)
    const targetFile = path.join(docsDir, `${to}.md`)
    const sourceDir = path.join(docsDir, from)
    const targetDir = path.join(docsDir, to)
    if (fs.existsSync(targetFile)) throw new Error(`Page exists: ${to}`)
    if (fs.existsSync(sourceDir) && fs.existsSync(targetDir)) throw new Error(`Page exists: ${to}`)
    fs.mkdirSync(path.dirname(targetFile), { recursive: true })
    fs.renameSync(sourceFile, targetFile)
    if (fs.existsSync(sourceDir)) fs.renameSync(sourceDir, targetDir)
  }

  private sessionPath(): string {
    return path.join(this.root, 'session.json')
  }

  private titlesPath(): string {
    return path.join(this.root, 'docs', '.titles.json')
  }

  private writeAtomic(file: string, contents: string | Buffer): void {
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, contents)
    fs.renameSync(tmp, file)
  }
}
