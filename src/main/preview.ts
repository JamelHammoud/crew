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
export class Previews {
  private made = new Map<string, string>()

  async show(key: string, absolute: string, text: string): Promise<string | null> {
    const file = path.join(FOLDER, `${randomUUID()}.html`)
    try {
      await fs.mkdir(FOLDER, { recursive: true })
      await fs.writeFile(file, withBase(text, baseUrl(absolute)), 'utf8')
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
