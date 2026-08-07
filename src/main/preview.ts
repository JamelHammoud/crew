import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { baseUrl, fileUrl, withBase } from '../shared/htmlPage'

const FOLDER = path.join(os.tmpdir(), 'crew-previews')

// A page a window is reading, written out where the app can load it. It never
// lands beside the file it was drawn from: a page written into the project would
// be committed and synced to everyone in the crew for the few seconds somebody
// spends looking at it. Pages belong to the window that opened them, so closing
// one takes its own away and leaves every other window's alone.
//
// A page with no file behind it, which is one somebody attached, has no folder to
// read from and is handed no base at all, rather than being pointed at the root
// of the disk.
//
// Words that are only the head of a file are no page at all, so that one is
// loaded where it stands instead. A file too big to hold cannot be typed in
// either, so there is no edit to carry into a copy, and standing where it was
// written it needs no base and no ceiling.
export class Previews {
  private made = new Map<string, string>()

  async show(key: string, absolute: string, text: string | null): Promise<string | null> {
    if (text === null) {
      this.drop(key)
      return absolute ? fileUrl(absolute) : null
    }
    const file = path.join(FOLDER, `${randomUUID()}.html`)
    try {
      await fs.mkdir(FOLDER, { recursive: true })
      await fs.writeFile(file, withBase(text, absolute ? baseUrl(absolute) : ''), 'utf8')
    } catch {
      return null
    }
    this.drop(key)
    this.made.set(key, file)
    return fileUrl(file)
  }

  drop(key: string): void {
    const file = this.made.get(key)
    if (!file) return
    this.made.delete(key)
    void fs.rm(file, { force: true }).catch(() => undefined)
  }

  clear(): void {
    for (const key of [...this.made.keys()]) this.drop(key)
  }
}
