import { PILL_ROOM, PILL_WIDTH, restsOnScreen } from '../../../../shared/scribe'
import { CloseGlyph, RefreshGlyph, ScribeGlyph, WarningGlyph } from '../../icons'
import { STROKE_BOLD } from '../../icons/keylines'
import { BandReader, waveBands } from '../../media/bands'
import { scribeAnalyser, useScribe } from '../../state/scribe'
import InsetRing from '../InsetRing'
import Levels from '../Levels'
import { grab } from './grab'
import PillButton from './PillButton'
import ScribeHeld from './ScribeHeld'

// What is on screen while dictation is on. It stands there the whole time rather
// than arriving with a dictation and leaving with it, so at rest it is the mark
// and nothing else, small enough to be left somewhere and forgotten about, and
// it grows only while there is something to hear.
//
// It floats over whatever app you are typing into, which is why it wears
// `glass-pill`: nothing can blur what is behind a transparent window, so that
// material is lit rather than blurred, and the tint is the whole of it.
//
// Nothing on it is set in a solid grey for the same reason. Every mark takes the
// foreground at an opacity, so it stands above the surface rather than beside
// it, whatever the app underneath happens to be showing.

// Enough of them to read as a voice rather than as a handful of dots, and no
// more than that. The pill stands over somebody else's work, so every band it
// does not need is width taken off their window for nothing.
const BANDS = 12

// One reader for the life of the pill, because this is read every frame.
const reader = new BandReader()

export default function ScribePill() {
  const phase = useScribe(s => s.phase)
  const progress = useScribe(s => s.progress)
  const problem = useScribe(s => s.problem)
  const cancel = useScribe(s => s.cancel)
  const retry = useScribe(s => s.retry)
  const keeping = useScribe(s => s.keeping)
  const settings = useScribe(s => s.settings)

  const held = useScribe(s => s.held)

  const reading = phase === 'reading'
  const failed = phase === 'failed'
  const waking = phase === 'waking'
  const resting = phase === 'off'
  const again = failed && keeping()
  // Held words wait for the dictation to be over. They arrive a stretch at a time
  // while somebody is still talking, and the bars are what the pill has to say
  // for as long as there is a voice to draw: a card opening over them mid sentence
  // takes away the one thing that says Scribe is still listening.
  //
  // A failure comes first even though it has words behind it, because it is the
  // only state holding a way out of itself: a read that fell over halfway has
  // stretches held and a Try again for the rest, and a card drawn over that would
  // be the words so far standing where the way to the rest of them was. Closing it
  // is what shows the card, since the words are still held.
  const holding = held.length > 0 && resting

  // A pill that does not rest on screen has no resting state to draw. Its window
  // is up for the length of a dictation and no longer, and where the words went is
  // what decides whether it is put away or turned into a card, so it is still
  // standing there for as long as the paste takes. Drawn the moment the sound had
  // been read, the mark on its own is the pill flashing small over somebody's
  // window on the way out of every dictation.
  if (resting && !holding && !restsOnScreen(settings)) return null

  // The outer box is the room the shadow lands in. It is the window that is
  // larger rather than the pill, so this padding is what the two agree on, and
  // nothing in that margin takes the pointer: it is empty air standing over
  // somebody else's application.
  //
  // It is as wide as what it holds rather than as wide as the window, because
  // the window is now the one that follows: a pill that is on screen all day
  // may only ever swallow the clicks that land on the pill itself.
  //
  // The pill stands in the middle of it and opens from its own middle, so it is
  // where it was put whether it is open or shut.
  return (
    <div className="pointer-events-none w-fit flex justify-center" style={{ padding: PILL_ROOM }}>
      {holding ? (
        <ScribeHeld />
      ) : (
        /* The whole of it is the handle, so it is moved by taking hold of it
         anywhere rather than by finding a strip somewhere on it to aim at. The
         cursor is the only thing that says so, which is all it needs to. */
        <div
          onPointerDown={grab}
          style={failed ? { width: PILL_WIDTH } : undefined}
          className={`group pointer-events-auto relative glass glass-pill rounded-full flex items-center animate-pop cursor-grab active:cursor-grabbing ${
            resting ? 'h-7 px-3' : 'min-h-[40px] p-1.5'
          } ${failed ? '' : 'w-fit'}`}
        >
          <InsetRing className="border border-fg/10" />

          {/* At rest it is the mark and nothing else. There is nothing to hear, so
            a row of bars sitting at its floor would read as a microphone that
            has stopped, and nothing to press either: the key is what starts a
            dictation, so a button here would be a second answer to a question
            that already has one. */}
          {resting ? (
            <ScribeGlyph className="w-4 h-4 text-fg/45" strokeWidth={STROKE_BOLD} />
          ) : (
            <>
              {/* The one slot there is, and the pointer is what opens it. While
                somebody is talking the bars are the whole of what the pill has
                to say, and a button standing beside them the entire time is
                width taken off somebody else's window for something almost
                nobody presses. The eight pixels past the mark are the gap it
                opens with, so nothing stands to the left of the bars while it is
                shut.

                There is nothing here that finishes a dictation: the key opened
                it and the key is what ends it, and with the words already
                landing there is nothing left to hand over. */}
              <span
                className={`flex h-7 shrink-0 items-center overflow-hidden transition-[width] duration-200 ease-out ${
                  failed ? 'w-9' : 'w-0 group-hover:w-9'
                }`}
              >
                <PillButton label={failed ? 'Close' : 'Cancel'} onClick={cancel}>
                  <CloseGlyph className="w-3.5 h-3.5" strokeWidth={STROKE_BOLD} />
                </PillButton>
              </span>

              {failed ? (
                <p className="flex-1 min-w-0 flex items-center gap-1.5 text-xs text-fg/70 leading-tight">
                  <WarningGlyph className="w-4 h-4 shrink-0 text-danger" />
                  <span className="line-clamp-4">{problem ?? 'That did not work.'}</span>
                </p>
              ) : waking ? (
                // The model comes down once, ever. A bar rather than the row of
                // bars, because there is nothing to hear yet and a flat row of
                // dots reads as a microphone that is not working.
                <span className="w-16 h-1 rounded-full bg-fg/15 overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-fg/60 transition-[width] duration-200"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </span>
              ) : (
                // The row says what is happening to it: your own voice while it is
                // being heard, and a crest travelling through it while whisper
                // finishes, when there is no voice left to draw and a flat row
                // would read as a pill that has stopped.
                <Levels
                  count={BANDS}
                  from="middle"
                  read={(count, out) =>
                    reading ? waveBands(performance.now(), count, out) : reader.read(scribeAnalyser(), count, out)
                  }
                  className="w-16 h-5 px-1 text-fg/70 justify-between"
                  barClassName="w-[2px]"
                />
              )}

              {/* A failure that still has the sound offers to read it again. One
                whose sound never arrived has nothing to try, so it says nothing
                rather than offering a button that cannot work. */}
              {again && (
                <span className="ml-1.5 flex shrink-0">
                  <PillButton label="Try again" solid onClick={() => void retry()}>
                    <RefreshGlyph className="w-3.5 h-3.5" strokeWidth={STROKE_BOLD} />
                  </PillButton>
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
