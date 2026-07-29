import { PILL_ROOM } from '../../../../shared/scribe'
import { CheckGlyph, CloseGlyph, RefreshGlyph, WarningGlyph } from '../../icons'
import { STROKE_BOLD } from '../../icons/keylines'
import { BandReader } from '../../media/bands'
import { scribeAnalyser, useScribe } from '../../state/scribe'
import InsetRing from '../InsetRing'
import Levels from '../Levels'
import Spinner from '../Spinner'
import { grab } from './grab'

// What is on screen while you are dictating. It floats over whatever app you
// are typing into, which is why it wears `glass-pill`: nothing can blur what is
// behind a transparent window, so that material is lit rather than blurred, and
// the tint is the whole of it.
//
// Nothing on it is set in a solid grey for the same reason. Every mark takes the
// foreground at an opacity, so it stands above the surface rather than beside
// it, whatever the app underneath happens to be showing.

// Enough of them to read as a voice rather than as a handful of dots, and they
// stand across the whole of the room between the two buttons rather than
// huddling in the middle of it.
const BANDS = 17

// One reader for the life of the pill, because this is read every frame.
const reader = new BandReader()

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
      className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 ${
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
  const finish = useScribe(s => s.finish)
  const retry = useScribe(s => s.retry)
  const keeping = useScribe(s => s.keeping)

  const reading = phase === 'reading'
  const failed = phase === 'failed'
  const waking = phase === 'waking'
  const again = failed && keeping()

  // The outer box is the room the shadow lands in. It is the window that is
  // larger rather than the pill, so this padding is what the two agree on, and
  // nothing in that margin takes the pointer: it is empty air standing over
  // somebody else's application.
  return (
    <div className="pointer-events-none" style={{ padding: PILL_ROOM }}>
      {/* The whole of it is the handle, so it is moved by taking hold of it
          anywhere rather than by finding a strip somewhere on it to aim at. The
          cursor is the only thing that says so, which is all it needs to. */}
      <div
        onPointerDown={grab}
        className="pointer-events-auto relative glass glass-pill rounded-full min-h-[52px] px-2 py-2 flex items-center gap-2 animate-pop cursor-grab active:cursor-grabbing"
      >
        <InsetRing className="border border-fg/10" />

        <Round label={failed ? 'Close' : 'Cancel'} onClick={cancel}>
          <CloseGlyph className="w-4 h-4" strokeWidth={STROKE_BOLD} />
        </Round>

        {failed ? (
          <p className="flex-1 min-w-0 flex items-center gap-1.5 text-xs text-fg/70 leading-tight">
            <WarningGlyph className="w-4 h-4 shrink-0 text-danger" />
            <span className="line-clamp-2">{problem ?? 'That did not work.'}</span>
          </p>
        ) : waking ? (
          // The model comes down once, ever. A bar rather than the row of bars,
          // because there is nothing to hear yet and a flat row of dots reads as
          // a microphone that is not working.
          <span className="flex-1 min-w-0 h-1 rounded-full bg-fg/15 overflow-hidden">
            <span
              className="block h-full rounded-full bg-fg/60 transition-[width] duration-200"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </span>
        ) : (
          // The bars settle while whisper finishes rather than freezing, so a
          // slow reading is a pill that is working rather than one that has
          // stopped.
          <Levels
            count={BANDS}
            read={(count, out) => reader.read(reading ? null : scribeAnalyser(), count, out)}
            className="flex-1 min-w-0 h-6 px-1 text-fg/70 justify-between"
            barClassName="w-[3px]"
          />
        )}

        {reading || waking ? (
          <span className="w-8 h-8 shrink-0 flex items-center justify-center text-fg/70">
            <Spinner size={18} />
          </span>
        ) : failed ? (
          // A failure that still has the sound offers to read it again. One
          // whose sound never arrived has nothing to try, so it says nothing
          // rather than offering a button that cannot work.
          again && (
            <Round label="Try again" solid onClick={() => void retry()}>
              <RefreshGlyph className="w-4 h-4" strokeWidth={STROKE_BOLD} />
            </Round>
          )
        ) : (
          <Round label="Done" solid onClick={() => void finish()}>
            <CheckGlyph className="w-4 h-4" strokeWidth={STROKE_BOLD} />
          </Round>
        )}
      </div>
    </div>
  )
}
