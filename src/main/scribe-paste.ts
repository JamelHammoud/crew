import { clipboard } from 'electron'
import type { ScribeFinish } from '../shared/scribe'
import { tapPaste } from './scribe-keys'

// How long the app being typed into gets to read the clipboard before what was
// on it is put back. Short enough that nobody notices their clipboard was
// borrowed, long enough that a slow app still gets the text.
const HOLD_MS = 420

// A dictation written as it is said pastes several times, and the app on the
// other side reads the clipboard a moment after the keystroke lands rather than
// at the instant of it. Two pastes closer together than this and the second one
// overwrites the clipboard the first is still on its way to read, which lands
// one stretch twice and loses the other.
const SETTLE_MS = 200

export interface Delivered {
  ok: boolean
  problem: string | null
}

const done: Delivered = { ok: true, problem: null }

const wait = (ms: number): Promise<void> => new Promise(go => setTimeout(go, ms))

// What was already on the clipboard, both ways it can be held. Pasting a
// dictation must not cost somebody the thing they copied a minute ago, so the
// text and the html are both saved and both go back.
interface Held {
  text: string
  html: string
}

function take(): Held {
  return { text: clipboard.readText(), html: clipboard.readHTML() }
}

function give(held: Held): void {
  if (!held.text && !held.html) {
    clipboard.clear()
    return
  }
  if (held.html) clipboard.write({ text: held.text, html: held.html })
  else clipboard.writeText(held.text)
}

// Borrowed once for a run of pastes rather than once each. A dictation that
// writes as it is said hands the clipboard over several times, and giving it
// back between two of them would put somebody's own text in front of the paste
// still on its way.
let borrowed: Held | null = null
let giving: ReturnType<typeof setTimeout> | undefined

function borrow(): void {
  clearTimeout(giving)
  if (!borrowed) borrowed = take()
}

function giveLater(): void {
  clearTimeout(giving)
  giving = setTimeout(() => {
    if (borrowed) give(borrowed)
    borrowed = null
  }, HOLD_MS)
}

// The keystroke never went, so the text stays where it is. One press of paste
// and it is where it was going, which is worse than we promised and better than
// nothing, and putting the old clipboard back would take even that away.
function keep(): void {
  clearTimeout(giving)
  borrowed = null
}

// One at a time, in the order they were spoken. Nothing here runs beside
// anything else here, because both halves of a paste, the writing and the
// keystroke, are the one clipboard.
let queue: Promise<Delivered> = Promise.resolve(done)

export function deliver(text: string, finish: ScribeFinish): Promise<Delivered> {
  queue = queue.then(() => paste(text, finish))
  return queue
}

async function paste(text: string, finish: ScribeFinish): Promise<Delivered> {
  if (!text) return done
  if (finish === 'copy') {
    clipboard.writeText(text)
    return done
  }
  borrow()
  clipboard.writeText(text)
  if (!tapPaste()) {
    keep()
    return {
      ok: false,
      problem: 'Crew could not paste it. It is on your clipboard.'
    }
  }
  await wait(SETTLE_MS)
  giveLater()
  return done
}
