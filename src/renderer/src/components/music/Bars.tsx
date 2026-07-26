import { useEffect, useRef } from 'react'
import { useMusic } from '../../state/music'

// The floor a bar never falls below, so a quiet moment is a row of dots rather
// than nothing at all.
const FLOOR = 0.14

// How fast a bar falls. It jumps straight to whatever the music is doing and
// eases back down, which is what makes a beat read as a hit rather than a wave.
const FALL = 0.16

// The music's own loudness, drawn. Every bar is a band of it, low on the left
// and high on the right, so the bass moves one end and a spark the other. The
// heights are written straight onto the elements rather than held in state:
// this runs every frame, and a render a frame would cost the whole panel.
export default function Bars({
  count,
  className = '',
  barClassName = ''
}: {
  count: number
  className?: string
  barClassName?: string
}) {
  const bars = useRef<Array<HTMLSpanElement | null>>([])

  useEffect(() => {
    const read = new Array<number>(count).fill(0)
    const held = new Array<number>(count).fill(FLOOR)
    let frame = requestAnimationFrame(function tick() {
      const levels = useMusic.getState().levels(count, read)
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
