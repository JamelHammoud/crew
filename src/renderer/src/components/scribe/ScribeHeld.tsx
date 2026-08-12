import { useEffect, useState } from 'react'
import { HELD_WIDTH, HELD_WORDS } from '../../../../shared/scribe'
import { CloseGlyph, ScribeGlyph } from '../../icons'
import { STROKE_BOLD } from '../../icons/keylines'
import InsetRing from '../InsetRing'
import { useScribe } from '../../state/scribe'
import { grab } from './grab'
import PillButton from './PillButton'

// A dictation that had nothing to write into. Scribe writes where the caret is, so
// one started with the caret nowhere used to be read, tidied and pasted into
// nothing, and the words were gone. They stand here instead, with the one thing to
// do about them.
//
// It is the pill's own window grown into a card, which is what gives it the place
// it was left, the drag, the room its shadow lands in and the material without any
// of that being written again.

// How long the button says what it did. Long enough to be read on the way to
// another window, short enough that a card left open does not sit there claiming
// something happened a minute ago.
const SAID_MS = 1600

export default function ScribeHeld() {
  const held = useScribe(s => s.held)
  const copy = useScribe(s => s.copy)
  const letGo = useScribe(s => s.letGo)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const clock = setTimeout(() => setCopied(false), SAID_MS)
    return () => clearTimeout(clock)
  }, [copied])

  // The words themselves are the only thing on the card that is not the app's own
  // chrome, so the drag is taken off them: a pointer coming down on what somebody
  // said is somebody about to select it by hand, and moving the window out from
  // under that is the one gesture this card must not steal.
  return (
    <div
      onPointerDown={grab}
      style={{ width: HELD_WIDTH }}
      className="pointer-events-auto relative glass glass-pill rounded-card p-3 flex flex-col gap-2 animate-pop cursor-grab active:cursor-grabbing"
    >
      <InsetRing className="border border-fg/10" />

      <div className="flex items-center gap-2">
        <ScribeGlyph className="w-4 h-4 shrink-0 text-fg/45" strokeWidth={STROKE_BOLD} />
        {/* Where the words were going, said as the thing to do about it rather
            than as what went wrong. Nothing here names the caret or the paste: a
            person knows what they were about to type in. */}
        <p className="flex-1 min-w-0 text-xs text-fg/45 leading-tight">Click into a text box, then dictate</p>
        <PillButton label="Close" onClick={letGo}>
          <CloseGlyph className="w-3.5 h-3.5" strokeWidth={STROKE_BOLD} />
        </PillButton>
      </div>

      <p
        onPointerDown={event => event.stopPropagation()}
        style={{ maxHeight: HELD_WORDS }}
        className="select-text cursor-text overflow-y-auto text-sm text-fg/90 leading-snug whitespace-pre-wrap break-words"
      >
        {held}
      </p>

      <div className="flex justify-end">
        {/* One press, and it says so afterwards. There is no toast over another
            application's window and nothing else on the card can change, so the
            button turning over is the whole of how anybody knows the clipboard
            took it. */}
        <button
          onClick={() => {
            copy()
            setCopied(true)
          }}
          onPointerDown={event => event.stopPropagation()}
          className="h-7 px-3 shrink-0 rounded-full bg-fg text-ink-900 text-xs font-medium transition-all duration-150 hover:bg-fg/90 active:scale-95"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
