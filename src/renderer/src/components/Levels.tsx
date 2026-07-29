import { useEffect, useRef } from 'react'

// Loudness drawn as a row of bars, low on the left and high on the right. The
// music plays through it and a dictation is heard through it, so it takes the
// reading rather than knowing where one comes from.
//
// The heights are written straight onto the elements rather than held in state.
// This runs every frame, and a render a frame would cost whatever it stands in.

// The floor a bar never falls below, so a quiet moment is a row of dots rather
// than nothing at all.
const FLOOR = 0.14

// How fast a bar falls. It jumps straight to whatever it is hearing and eases
// back down, which is what makes a beat read as a hit rather than a wave.
const FALL = 0.16

export default function Levels({
  count,
  read,
  className = '',
  barClassName = ''
}: {
  count: number
  read: (count: number, out: number[]) => number[]
  className?: string
  barClassName?: string
}) {
  const bars = useRef<Array<HTMLSpanElement | null>>([])
  const reader = useRef(read)
  reader.current = read

  useEffect(() => {
    const out = new Array<number>(count).fill(0)
    const held = new Array<number>(count).fill(FLOOR)
    let frame = requestAnimationFrame(function tick() {
      const levels = reader.current(count, out)
      for (let band = 0; band < count; band++) {
        const want = FLOOR + (1 - FLOOR) * Math.min(1, Math.max(0, levels[band]))
        held[band] = want > held[band] ? want : held[band] + (want - held[band]) * FALL
        const bar = bars.current[band]
        if (!bar) continue
        bar.style.height = `${(held[band] * 100).toFixed(1)}%`
        bar.style.opacity = String(0.45 + held[band] * 0.55)
      }
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [count])

  return (
    <span className={`flex items-end ${className}`} aria-hidden>
      {Array.from({ length: count }, (_, band) => (
        <span
          key={band}
          ref={node => {
            bars.current[band] = node
          }}
          style={{ height: `${FLOOR * 100}%` }}
          className={`block rounded-full bg-current ${barClassName}`}
        />
      ))}
    </span>
  )
}
