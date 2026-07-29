import { clipboard } from 'electron'
import type { ScribeFinish } from '../shared/scribe'
import { tapPaste } from './scribe-keys'

// How long the app being typed into gets to read the clipboard before what was
// on it is put back. Short enough that nobody notices their clipboard was
// borrowed, long enough that a slow app still gets the text.
const HOLD_MS = 420

export interface Delivered {
  ok: boolean
  problem: string | null
}

const done: Delivered = { ok: true, problem: null }

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

export function deliver(text: string, finish: ScribeFinish): Delivered {
  if (!text) return done
  if (finish === 'copy') {
    clipboard.writeText(text)
    return done
  }
  const held = take()
  clipboard.writeText(text)
  if (!tapPaste()) {
    // The keystroke could not be sent, so the text stays on the clipboard rather
    // than being put back and lost. One press of paste and it is where it was
    // going, which is a worse dictation than we promised and a better one than
    // none.
    return {
      ok: false,
      problem: 'Crew could not paste it. It is on your clipboard.'
    }
  }
  setTimeout(() => give(held), HOLD_MS)
  return done
}
