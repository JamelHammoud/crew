import { CheckGlyph, CloseGlyph, RefreshGlyph, WarningGlyph } from '../../icons'
import { BandReader } from '../../media/bands'
import { scribeAnalyser, useScribe } from '../../state/scribe'
import InsetRing from '../InsetRing'
import Levels from '../Levels'
import Spinner from '../Spinner'

// What is on screen while you are dictating. It floats over whatever app you
// are typing into, which is why it is `glass-strong`: a white window behind
// ordinary glass turns the panel into pale grey, and what comes through a
// floating panel is the color of what is behind it, never its edges.
//
// Nothing on it is set in a solid grey for the same reason. Every mark takes the
// foreground at an opacity, so it stands above the surface rather than beside
// it, whatever the app underneath happens to be showing.

const BANDS = 13

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

  return (
    <div className="p-1.5 h-full">
      <div className="relative glass glass-strong rounded-full h-14 px-2 flex items-center gap-2 animate-pop">
        <InsetRing className="border border-fg/10" />

        <Round label={failed ? 'Close' : 'Cancel'} onClick={cancel}>
          <CloseGlyph className="w-4 h-4" />
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
            className="flex-1 min-w-0 h-6 gap-[3px] text-fg/70 justify-center"
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
              <RefreshGlyph className="w-4 h-4" />
            </Round>
          )
        ) : (
          <Round label="Done" solid onClick={() => void finish()}>
            <CheckGlyph className="w-4 h-4" />
          </Round>
        )}
      </div>
      {/* Only ever the first time, and only while it is really coming down. A
          ring that is always there says the model is a thing to wait for, and
          after the first dictation it never is. */}
      {waking && progress > 0 && progress < 1 && (
        <div className="absolute left-5 right-5 bottom-[7px] h-[3px] rounded-full bg-fg/15 overflow-hidden">
          <span
            className="block h-full rounded-full bg-fg/60 transition-[width] duration-200"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
