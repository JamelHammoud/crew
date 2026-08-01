// How many other Crew processes are live on this machine. There is no lock on
// the app and there is not meant to be one: the crew command opens a process per
// folder, so several are normal here. A process knows its own windows and
// nothing whatever about anybody else's, so each one leaves a file named after
// its pid and the answer is read back off the names in that folder.
//
// The rule is here so a suite can drive it with no folder and no second process
// anywhere near it. Whether a pid is really alive is handed in.

export type Alive = (pid: number) => boolean

export interface Instances {
  others: number[]
  stale: string[]
}

const PREFIX = 'crew-'
const SUFFIX = '.pid'
const DIGITS = /^[1-9]\d*$/

export function pidFileName(pid: number): string {
  return `${PREFIX}${pid}${SUFFIX}`
}

// A mark outlives the process that wrote it whenever a Crew dies without tidying
// up, and the machine hands that number out again afterwards, so the file answers
// as a live Crew the moment anything at all is wearing its pid. Nothing about
// that ever clears itself, and what it holds up is every update from then on. A
// mark written before the machine last came up cannot belong to anything running
// now, whatever the pid in its name answers to.
//
// The margin is which way to be wrong. Reading a live Crew as gone is what lets
// an installer take its work down, so a mark has to be clearly older than the
// boot rather than a moment older, and a clock that moved under us is not enough
// to make one stale. A mark nobody can read at all is nobody, the same answer a
// folder nobody can read gives.
export const BOOT_MARGIN_MS = 60_000

export function outlivedBoot(written: number, booted: number): boolean {
  return written + BOOT_MARGIN_MS < booted
}

// The name is written and read in one place, so the two can never disagree.
// Anything else in the folder comes back as null rather than as NaN, which would
// be a pid nothing can be asked about and every comparison against it false.
export function pidInFileName(name: string): number | null {
  if (!name.startsWith(PREFIX) || !name.endsWith(SUFFIX)) return null
  const digits = name.slice(PREFIX.length, -SUFFIX.length)
  return DIGITS.test(digits) ? Number(digits) : null
}

// Our own pid is never one of the others. A file whose process has gone is a
// process that died without tidying up rather than an instance to count, so it
// is handed back as stale for whoever is holding the folder to take away.
export function instancesIn(names: string[], own: number, alive: Alive): Instances {
  const others = new Set<number>()
  const stale: string[] = []
  for (const name of names) {
    const pid = pidInFileName(name)
    if (pid === null || pid === own) continue
    if (alive(pid)) others.add(pid)
    else stale.push(name)
  }
  return { others: [...others], stale }
}
