import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {
  STICKY_COLORS,
  type CreateStickyInput,
  type Sticky,
  type StickyColor,
  type UpdateStickyInput
} from '../shared/stickies'

const FILE = 'stickies.json'
const FILE_MODE = 0o600
const COLORS = new Set<string>(STICKY_COLORS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function colorFrom(value: unknown): StickyColor | null {
  return typeof value === 'string' && COLORS.has(value) ? (value as StickyColor) : null
}

function timeFrom(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function titleFrom(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const title = value.trim()
  return title || undefined
}

function stickyFrom(value: unknown): Sticky | null {
  if (!isRecord(value)) return null
  const id = typeof value.id === 'string' ? value.id.trim() : ''
  const color = colorFrom(value.color)
  const createdAt = timeFrom(value.createdAt)
  const updatedAt = timeFrom(value.updatedAt)
  if (!id || typeof value.body !== 'string' || !color || typeof value.pinned !== 'boolean') return null
  if (createdAt === null || updatedAt === null) return null
  const title = titleFrom(value.title)
  return {
    id,
    ...(title ? { title } : {}),
    body: value.body,
    color,
    pinned: value.pinned,
    createdAt,
    updatedAt
  }
}

function ordered(stickies: Sticky[]): Sticky[] {
  return [...stickies].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt
    return a.id.localeCompare(b.id)
  })
}

function assertBody(body: unknown): asserts body is string {
  if (typeof body !== 'string') throw new TypeError('A sticky body must be a string')
}

function assertColor(color: unknown): asserts color is StickyColor {
  if (!colorFrom(color)) throw new TypeError('A sticky color must be one of the supported colors')
}

function assertPinned(pinned: unknown): asserts pinned is boolean {
  if (typeof pinned !== 'boolean') throw new TypeError('A sticky pinned value must be a boolean')
}

export class StickyStore {
  readonly file: string

  constructor(
    userData: string,
    private readonly clock: () => number = Date.now
  ) {
    this.file = path.join(userData, FILE)
  }

  list(): Sticky[] {
    return ordered(this.read())
  }

  create(input: CreateStickyInput): Sticky {
    assertBody(input.body)
    if (input.color !== undefined) assertColor(input.color)
    if (input.pinned !== undefined) assertPinned(input.pinned)
    const now = this.clock()
    const title = titleFrom(input.title)
    const sticky: Sticky = {
      id: randomUUID(),
      ...(title ? { title } : {}),
      body: input.body,
      color: input.color ?? 'yellow',
      pinned: input.pinned ?? false,
      createdAt: now,
      updatedAt: now
    }
    this.write([...this.read(), sticky])
    return sticky
  }

  update(id: string, patch: UpdateStickyInput): Sticky | null {
    if (patch.body !== undefined) assertBody(patch.body)
    if (patch.color !== undefined) assertColor(patch.color)
    if (patch.pinned !== undefined) assertPinned(patch.pinned)
    const stickies = this.read()
    const index = stickies.findIndex(sticky => sticky.id === id)
    if (index < 0) return null
    const current = stickies[index]
    const title = patch.title === undefined ? current.title : titleFrom(patch.title)
    const updated: Sticky = {
      id: current.id,
      ...(title ? { title } : {}),
      body: patch.body ?? current.body,
      color: patch.color ?? current.color,
      pinned: patch.pinned ?? current.pinned,
      createdAt: current.createdAt,
      updatedAt: this.clock()
    }
    stickies[index] = updated
    this.write(stickies)
    return updated
  }

  delete(id: string): boolean {
    const stickies = this.read()
    const kept = stickies.filter(sticky => sticky.id !== id)
    if (kept.length === stickies.length) return false
    this.write(kept)
    return true
  }

  private read(): Sticky[] {
    let text: string
    try {
      text = fs.readFileSync(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      this.quarantine()
      return []
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      this.quarantine()
      return []
    }
    if (!Array.isArray(parsed)) {
      this.quarantine()
      return []
    }
    const seen = new Set<string>()
    const stickies: Sticky[] = []
    for (const value of parsed) {
      const sticky = stickyFrom(value)
      if (!sticky || seen.has(sticky.id)) continue
      seen.add(sticky.id)
      stickies.push(sticky)
    }
    return stickies
  }

  private quarantine(): void {
    try {
      fs.renameSync(this.file, `${this.file}.corrupt-${Date.now()}`)
    } catch {}
  }

  private write(stickies: Sticky[]): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const temporary = `${this.file}.${process.pid}.${randomUUID()}.tmp`
    try {
      fs.writeFileSync(temporary, JSON.stringify(ordered(stickies), null, 2), { mode: FILE_MODE })
      fs.chmodSync(temporary, FILE_MODE)
      fs.renameSync(temporary, this.file)
    } catch (error) {
      try {
        fs.rmSync(temporary, { force: true })
      } catch {}
      throw error
    }
  }
}
