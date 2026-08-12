import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OtherInstances, alive } from '../src/main/instances'
import { BOOT_MARGIN_MS, instancesIn, outlivedBoot, pidFileName, pidInFileName } from '../src/shared/instances'

// Whether any other Crew is live on this machine, against a real folder and real
// processes. Nothing here goes near electron: the folder is handed in the way the
// scribe history is handed its file, which is the whole of what lets a folder in
// the temp directory stand in for the one the app keeps beside itself.

let dir = ''
const children: ChildProcess[] = []

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crew-instances-'))
})

afterEach(() => {
  for (const child of children.splice(0)) child.kill('SIGKILL')
  fs.rmSync(dir, { recursive: true, force: true })
})

const idle = async (): Promise<ChildProcess> => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
  children.push(child)
  await once(child, 'spawn')
  return child
}

// A pid nothing answers to, proved rather than picked out of the air: a process
// of our own, killed and waited for, so the machine has really let go of the
// number by the time it is written into a file.
const gone = async (): Promise<number> => {
  const child = await idle()
  const pid = child.pid as number
  child.kill('SIGKILL')
  await once(child, 'exit')
  return pid
}

const wrote = (name: string): string => {
  const file = path.join(dir, name)
  fs.writeFileSync(file, '')
  return file
}

const living =
  (...pids: number[]) =>
  (pid: number) =>
    pids.includes(pid)

describe('the name a pid file takes', () => {
  it('reads the pid back out of the name it writes', () => {
    expect(pidInFileName(pidFileName(4321))).toBe(4321)
  })

  // A junk name comes back as nothing rather than as NaN, which would be a pid
  // nobody can be asked about and every comparison against it false.
  it('makes nothing of a name it never wrote', () => {
    for (const name of ['notes.txt', '.DS_Store', 'crew-.pid', 'crew-abc.pid', 'crew-12.pid.bak', 'crew-12', '']) {
      expect(pidInFileName(name)).toBeNull()
    }
  })

  it('makes nothing of a pid written some other way', () => {
    expect(pidInFileName('crew-0012.pid')).toBeNull()
    expect(pidInFileName('crew-12.5.pid')).toBeNull()
    expect(pidInFileName('crew--12.pid')).toBeNull()
  })
})

describe('sorting the files in the folder', () => {
  it('is nobody when there is nothing there', () => {
    expect(instancesIn([], 100, living())).toEqual({ others: [], stale: [] })
  })

  it('never counts our own', () => {
    const found = instancesIn([pidFileName(100)], 100, living(100))
    expect(found.others).toEqual([])
    expect(found.stale).toEqual([])
  })

  it('counts the live ones that are not ours', () => {
    const names = [pidFileName(100), pidFileName(200), pidFileName(300)]
    expect(instancesIn(names, 100, living(100, 200, 300)).others).toEqual([200, 300])
  })

  // A process that died without tidying up left a file behind, so the file says
  // one thing and the machine says another. The machine is what counts.
  it('hands back a file whose process has gone as stale', () => {
    const found = instancesIn([pidFileName(200), pidFileName(300)], 100, living(300))
    expect(found.others).toEqual([300])
    expect(found.stale).toEqual([pidFileName(200)])
  })

  it('passes over anything else in the folder', () => {
    const found = instancesIn(['notes.txt', 'crew-abc.pid', pidFileName(200)], 100, living(200))
    expect(found.others).toEqual([200])
    expect(found.stale).toEqual([])
  })

  // Our own file is never stale, whatever the predicate says about it, or the one
  // process that is certainly here would take its own mark away as it counted.
  it('never calls our own file stale', () => {
    expect(instancesIn([pidFileName(100)], 100, living()).stale).toEqual([])
  })
})

describe('marking this process', () => {
  it('writes a file for its own pid, folder and all', () => {
    const room = path.join(dir, 'deeper', 'still')
    new OtherInstances(room).mark()
    expect(fs.readdirSync(room)).toEqual([pidFileName(process.pid)])
  })

  it('takes it away again', () => {
    const instances = new OtherInstances(dir)
    instances.mark()
    instances.forget()
    expect(fs.readdirSync(dir)).toEqual([])
  })

  it('is safe to ask twice, either way round', () => {
    const instances = new OtherInstances(dir)
    instances.mark()
    instances.mark()
    instances.forget()
    expect(() => instances.forget()).not.toThrow()
    expect(fs.readdirSync(dir)).toEqual([])
  })
})

describe('counting the other instances in a real folder', () => {
  it('is nobody when the only file there is our own', () => {
    const instances = new OtherInstances(dir)
    instances.mark()
    expect(instances.count()).toBe(0)
    expect(instances.others()).toEqual([])
  })

  it('counts a real process that is still going', async () => {
    const child = await idle()
    const instances = new OtherInstances(dir)
    instances.mark()
    wrote(pidFileName(child.pid as number))
    expect(instances.others()).toEqual([child.pid])
    expect(instances.count()).toBe(1)
  })

  it('leaves a live file where it stands', async () => {
    const child = await idle()
    const file = wrote(pidFileName(child.pid as number))
    new OtherInstances(dir).count()
    expect(fs.existsSync(file)).toBe(true)
  })

  it('makes nothing of a file whose process has gone, and clears it away', async () => {
    const file = wrote(pidFileName(await gone()))
    const instances = new OtherInstances(dir)
    instances.mark()
    expect(instances.count()).toBe(0)
    expect(fs.existsSync(file)).toBe(false)
  })

  it('counts the live one out of a folder holding both', async () => {
    const child = await idle()
    const dead = wrote(pidFileName(await gone()))
    const instances = new OtherInstances(dir)
    instances.mark()
    wrote(pidFileName(child.pid as number))
    expect(instances.others()).toEqual([child.pid])
    expect(fs.existsSync(dead)).toBe(false)
  })

  it('passes over a name it never wrote rather than throwing', () => {
    const junk = [wrote('notes.txt'), wrote('crew-abc.pid'), wrote('.DS_Store')]
    const instances = new OtherInstances(dir)
    expect(instances.count()).toBe(0)
    for (const file of junk) expect(fs.existsSync(file)).toBe(true)
  })

  // Claiming other instances are there when we cannot tell holds up whoever
  // asked for no reason, and the one thing they would do about it is stop.
  it('is nobody when the folder is not there at all', () => {
    const instances = new OtherInstances(path.join(dir, 'never-made'))
    expect(instances.count()).toBe(0)
    expect(instances.others()).toEqual([])
  })

  it('is nobody when the folder is a file', () => {
    const file = wrote('taken')
    expect(new OtherInstances(file).count()).toBe(0)
  })
})

// A pid is handed out again after a reboot, so a mark left behind by a Crew that
// died without tidying up answers as a live Crew forever once anything else is
// wearing its number. Nothing about that clears itself and it holds up every
// update from then on.
describe('a mark older than the machine coming up', () => {
  const booted = 1_000 * BOOT_MARGIN_MS

  it('is nothing, however alive the pid it names is', () => {
    expect(outlivedBoot(booted - BOOT_MARGIN_MS - 1, booted)).toBe(true)
  })

  it('stands while it was written since', () => {
    expect(outlivedBoot(booted + 1, booted)).toBe(false)
  })

  // Reading a live Crew as gone is what lets an installer take its work down, so
  // a mark is only stale when it is clearly older than the boot. A clock that
  // moved a little under us is not enough.
  it('gives a mark written around the boot the benefit of the doubt', () => {
    expect(outlivedBoot(booted - 1, booted)).toBe(false)
    expect(outlivedBoot(booted - BOOT_MARGIN_MS, booted)).toBe(false)
  })

  it('makes nothing of a mark nobody can read', () => {
    expect(outlivedBoot(0, booted)).toBe(true)
  })
})

describe('a folder holding a mark from before the machine came up', () => {
  const aged = (file: string) => {
    const then = new Date(Date.now() - os.uptime() * 1000 - BOOT_MARGIN_MS - 60_000)
    fs.utimesSync(file, then, then)
  }

  it('makes nothing of it even though its pid answers, and clears it away', async () => {
    const child = await idle()
    const file = wrote(pidFileName(child.pid as number))
    aged(file)
    const instances = new OtherInstances(dir)
    instances.mark()
    expect(instances.count()).toBe(0)
    expect(fs.existsSync(file)).toBe(false)
  })

  it('leaves one written since the machine came up where it stands', async () => {
    const child = await idle()
    const file = wrote(pidFileName(child.pid as number))
    const instances = new OtherInstances(dir)
    instances.mark()
    expect(instances.others()).toEqual([child.pid])
    expect(fs.existsSync(file)).toBe(true)
  })

  it('never reads our own mark as an old one', () => {
    const instances = new OtherInstances(dir)
    instances.mark()
    aged(path.join(dir, pidFileName(process.pid)))
    expect(instances.count()).toBe(0)
    expect(fs.existsSync(path.join(dir, pidFileName(process.pid)))).toBe(true)
  })
})

describe('asking whether a pid is alive', () => {
  it('says so for this very process', () => {
    expect(alive(process.pid)).toBe(true)
  })

  it('says so for a process we started', async () => {
    const child = await idle()
    expect(alive(child.pid as number)).toBe(true)
  })

  it('says nothing is there for a pid the machine has let go of', async () => {
    expect(alive(await gone())).toBe(false)
  })
})
