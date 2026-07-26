const frac = (n: number): number => n - Math.floor(n)

// Where a bar stands on a given beat. It is worked out rather than kept, so the
// same beat of the same tune is the same shape on everyone's screen: what the
// crew is looking at moves together the way what they are hearing does.
const peakOf = (beat: number, column: number): number =>
  0.4 + 0.6 * frac(Math.sin(beat * 12.9898 + column * 78.233) * 43758.5453)

const FLOOR = 0.16

export function heightsAt(at: number, bpm: number, count: number, playing: boolean): number[] {
  const beats = (at * bpm) / 60
  const beat = Math.floor(beats)
  const phase = beats - beat
  return Array.from({ length: count }, (_, column) => {
    const peak = peakOf(beat, column)
    if (!playing) return FLOOR + (peak - FLOOR) * 0.45
    return FLOOR + (peak - FLOOR) * (1 - phase) ** 1.4
  })
}

// The tune's own beat, drawn. Every bar lands together and falls away on its
// own, which is what a row of them dancing is.
export default function Bars({
  at,
  bpm,
  count,
  playing,
  className = '',
  barClassName = ''
}: {
  at: number
  bpm: number
  count: number
  playing: boolean
  className?: string
  barClassName?: string
}) {
  return (
    <span className={`flex items-end ${className}`} aria-hidden>
      {heightsAt(at, bpm, count, playing).map((height, column) => (
        <span
          key={column}
          className={`block rounded-full bg-fg ${barClassName}`}
          style={{ height: `${Math.round(height * 100)}%`, opacity: 0.45 + height * 0.55 }}
        />
      ))}
    </span>
  )
}
