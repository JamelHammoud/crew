import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// The part of the caret no suite can see. A suite can say the rule is right about
// roles and attribute lists somebody wrote down; only this can say the
// applications on a real Mac hand back those words at all, which is the whole
// thing the rule rests on.
//
// It asks processes that are already running, from where they stand. Nothing here
// activates anything: the point of the feature is a dictation started over
// somebody else's work, and a check that takes their window to look at it is
// looking at the wrong thing.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

// The one line of the script that says whose caret is being asked about. Swapping
// it for a named process is what lets this ask Finder without Finder coming to
// the front, and it is a swap rather than a second script so what runs here is
// the script the app really sends.
const FRONTMOST = 'first application process whose frontmost is true'

// Finder is on every Mac and has a caret in it about as often as anything does.
// Crew is asked when it is running, since the app's own fields are the ones this
// feature was written against.
const ASKED = ['Finder', 'Crew']

const CARET = 'AXSelectedTextRange'
const EDITABLE = 'AXEditableAncestor'

// The verdict is a line rather than an exit code, because every answer here comes
// back 'unknown' when Accessibility will not talk to us, and an unknown reads
// exactly like a rule that is broken. The line is what tells those two apart, and
// a machine that is not a Mac is neither of them.
const VERDICT = 'scribe-caret-check:'

const PATIENCE_MS = 5000

async function bundled(dir, from, name) {
  const file = path.join(dir, name)
  await build({
    entryPoints: [path.join(root, from)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    outfile: file,
    logLevel: 'error'
  })
  return import(file)
}

function run(script) {
  return new Promise(answer => {
    execFile('osascript', ['-e', script], { timeout: PATIENCE_MS }, (problem, printed, complaint) =>
      answer({
        printed: printed ?? '',
        problem: problem ? (complaint || problem.message).trim().split('\n')[0] : null
      })
    )
  })
}

function read(printed) {
  const lines = printed.trim().split('\n')
  return {
    role: (lines[0] ?? '').trim(),
    attributes: (lines[1] ?? '')
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
  }
}

// A process that handed over no focused element at all is the one answer worth
// telling apart from a role, because it is what every Chromium application says
// the whole time somebody's caret is in a box: Crew, Discord, VS Code, Figma and
// Chrome alike. Printed as a role it reads as an application that answered.
function say(who, printed, landing) {
  const { role, attributes } = read(printed)
  const has = name => (attributes.includes(name) ? 'yes' : 'no ')
  if (role === 'unknown' && attributes.length === 0) {
    console.log(`${who.padEnd(10)} said nothing, no tree built                        landing ${landing}`)
    return
  }
  console.log(
    `${who.padEnd(10)} role ${(role || 'nothing').padEnd(14)}` +
      ` caret ${has(CARET)}  editable ${has(EDITABLE)}  landing ${landing}`
  )
}

async function running() {
  const { printed, problem } = await run('tell application "System Events" to return name of every application process')
  if (problem) return []
  return printed
    .split(',')
    .map(name => name.trim())
    .filter(Boolean)
}

async function check() {
  if (process.platform !== 'darwin') {
    console.log('a Mac is the only machine that will say what has the caret, so there is nothing to ask here')
    console.log(`${VERDICT} not on this machine`)
    return
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'crew-caret-'))
  let bad = false
  try {
    const [{ CARET_SCRIPT, askCaret }, { landingOf }] = await Promise.all([
      bundled(dir, 'src/main/scribe-caret.ts', 'caret.mjs'),
      bundled(dir, 'src/shared/scribeLanding.ts', 'landing.mjs')
    ])

    // Said first and on its own line. Without it every answer below is 'unknown'
    // and there is nothing on screen to say whether that is the permission or the
    // rule.
    const reach = await run('tell application "System Events" to return name of first application process')
    if (reach.problem) {
      console.log(`access: no, System Events would not answer: ${reach.problem}`)
      console.log('access: grant this terminal Accessibility in System Settings, or every answer below is unknown')
      bad = true
    } else {
      console.log('access: yes, System Events answers, so an unknown below is the rule and not the permission')
    }

    const front = await run(CARET_SCRIPT)
    if (front.problem) {
      console.error(`the script the app sends would not run: ${front.problem}`)
      bad = true
    } else {
      say('frontmost', front.printed, landingOf(front.printed))
      console.log(`askCaret:  ${await askCaret()}, which is the answer the app itself gets`)
    }

    const there = await running()
    const asked = ASKED.filter(name => there.includes(name))
    for (const name of asked) {
      const { printed, problem } = await run(CARET_SCRIPT.replace(FRONTMOST, `application process "${name}"`))
      if (problem) {
        console.error(`${name} would not answer: ${problem}`)
        bad = true
        continue
      }
      say(name, printed, landingOf(printed))
    }
    if (asked.length === 0) {
      console.error('no process could be asked by name, so nothing here was really read off a Mac')
      bad = true
    }

    if (!bad) console.log('real applications, the real script, the real rule reading what they answered')
  } catch (error) {
    console.error(`the caret check fell over: ${error.message}`)
    bad = true
  } finally {
    await rm(dir, { recursive: true, force: true })
  }

  console.log(`${VERDICT} ${bad ? 'failed' : 'passed'}`)
  if (bad) process.exitCode = 1
}

await check()
