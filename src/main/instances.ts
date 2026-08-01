import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { instancesIn, outlivedBoot, pidFileName, type Alive } from '../shared/instances'

// The doing half of counting the other Crew processes. The rule is in shared,
// where a suite drives it without a folder anywhere near it, and this is the
// folder itself. It is handed the folder rather than reaching for one, the way
// the scribe history is handed the file it writes to, so nothing here has to know
// where the app keeps what it remembers for itself.

// A signal of 0 sends nothing and only asks. It throws for a pid that has gone,
// which is the whole of the reading, and it throws EPERM for one that is there
// but belongs to somebody else, which is a live process all the same.
export const alive: Alive = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (why) {
    return (why as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export class OtherInstances {
  constructor(private dir: string) {}

  // The name is the whole of the record, so the file itself is empty.
  mark(): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true })
      fs.writeFileSync(this.file, '')
    } catch {}
  }

  forget(): void {
    this.drop(pidFileName(process.pid))
  }

  // A folder that cannot be read is nobody rather than somebody. Claiming other
  // instances are there when we cannot tell holds up whoever asked for no reason,
  // and the one thing they would do about it is stop.
  others(): number[] {
    let names: string[] = []
    try {
      names = fs.readdirSync(this.dir)
    } catch {
      return []
    }
    const { others, stale } = instancesIn(names, process.pid, alive)
    const booted = Date.now() - os.uptime() * 1000
    const live: number[] = []
    for (const pid of others) {
      const name = pidFileName(pid)
      if (outlivedBoot(this.written(name), booted)) stale.push(name)
      else live.push(pid)
    }
    for (const name of stale) this.drop(name)
    return live
  }

  private written(name: string): number {
    return fs.statSync(path.join(this.dir, name), { throwIfNoEntry: false })?.mtimeMs ?? 0
  }

  count(): number {
    return this.others().length
  }

  private get file(): string {
    return path.join(this.dir, pidFileName(process.pid))
  }

  private drop(name: string): void {
    try {
      fs.rmSync(path.join(this.dir, name), { force: true })
    } catch {}
  }
}
