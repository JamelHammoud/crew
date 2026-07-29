import { PILL_ROOM, PILL_WIDTH } from '../../../../shared/scribe'
import { CloseGlyph, RefreshGlyph, ScribeGlyph, WarningGlyph } from '../../icons'
import { STROKE_BOLD } from '../../icons/keylines'
import { BandReader, waveBands } from '../../media/bands'
import { scribeAnalyser, useScribe } from '../../state/scribe'
import InsetRing from '../InsetRing'
import Levels from '../Levels'
import { grab } from './grab'

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

// The marks on the pill are read at arm's length over somebody else's window,
// so they wear the bold weight rather than the one a mark carries inside the
// app.
function Round({
  label,
  solid,
  onClick,
  children
}: {
  label: string
  solid?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      // The pill is dragged by anywhere on it, so a button says the press is
      // its own rather than the start of a move.
      onPointerDown={event => event.stopPropagation()}
      aria-label={label}
      className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 ${
        solid ? 'bg-fg text-ink-900 hover:bg-fg/90' : 'bg-fg/10 text-fg/70 hover:bg-fg/20 hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}

export default function ScribePill() {
  const phase = useScribe(s => s.phase)
  const progress = useScribe(s => s.progress)
  const problem = useScribe(s => s.problem)
  const cancel = useScribe(s => s.cancel)
  const retry = useScribe(s => s.retry)
  const keeping = useScribe(s => s.keeping)

  const reading = phase === 'reading'
  const failed = phase === 'failed'
  const waking = phase === 'waking'
  const resting = phase === 'off'
  const again = failed && keeping()

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
      {/* The whole of it is the handle, so it is moved by taking hold of it
          anywhere rather than by finding a strip somewhere on it to aim at. The
          cursor is the only thing that says so, which is all it needs to. */}
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
        {resting && <ScribeGlyph className="w-4 h-4 text-fg/45" strokeWidth={STROKE_BOLD} />}

        {/* The one slot there is, and the pointer is what opens it. While
            somebody is talking the bars are the whole of what the pill has to
            say, and a button standing beside them the entire time is width taken
            off somebody else's window for something almost nobody presses. The
            eight pixels past the mark are the gap it opens with, so nothing
            stands to the left of the bars while it is shut.

            There is nothing here that finishes a dictation: the key opened it
            and the key is what ends it, and with the words already landing there
            is nothing left to hand over. */}
        {!resting && (
          <span
            className={`flex h-7 shrink-0 items-center overflow-hidden transition-[width] duration-200 ease-out ${
              failed ? 'w-9' : 'w-0 group-hover:w-9'
            }`}
          >
            <Round label={failed ? 'Close' : 'Cancel'} onClick={cancel}>
              <CloseGlyph className="w-3.5 h-3.5" strokeWidth={STROKE_BOLD} />
            </Round>
          </span>
        )}

        {resting ? null : failed ? (
          <p className="flex-1 min-w-0 flex items-center gap-1.5 text-xs text-fg/70 leading-tight">
            <WarningGlyph className="w-4 h-4 shrink-0 text-danger" />
            <span className="line-clamp-2">{problem ?? 'That did not work.'}</span>
          </p>
        ) : waking ? (
          // The model comes down once, ever. A bar rather than the row of bars,
          // because there is nothing to hear yet and a flat row of dots reads as
          // a microphone that is not working.
          <span className="w-20 h-1 rounded-full bg-fg/15 overflow-hidden">
            <span
              className="block h-full rounded-full bg-fg/60 transition-[width] duration-200"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </span>
        ) : (
          // The row says what is happening to it: your own voice while it is
          // being heard, and a crest travelling through it while whisper
          // finishes, when there is no voice left to draw and a flat row would
          // read as a pill that has stopped.
          <Levels
            count={BANDS}
            from="middle"
            read={(count, out) =>
              reading
                ? waveBands(performance.now(), count, out)
                : reader.read(scribeAnalyser(), count, out)
            }
            className="w-20 h-6 px-1 text-fg/70 justify-between"
            barClassName="w-[3px]"
          />
        )}

        {/* A failure that still has the sound offers to read it again. One whose
            sound never arrived has nothing to try, so it says nothing rather
            than offering a button that cannot work. */}
        {again && (
          <span className="ml-2 flex shrink-0">
            <Round label="Try again" solid onClick={() => void retry()}>
              <RefreshGlyph className="w-4 h-4" strokeWidth={STROKE_BOLD} />
            </Round>
          </span>
        )}
      </div>
    </div>
  )
}
