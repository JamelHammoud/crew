import { useEffect, useRef, useState } from 'react'
import WarpField from '../components/boot/WarpField'
import { CrewGlow, CrewMark } from '../components/CrewMark'
import { playSound } from '../media/sounds'

// When the field has come off lightspeed far enough for the crew to land on it.
const ARRIVE = 560

// The three discs arriving and the light finishing its way across them. The
// boot holds for at least that, so the mark lands rather than flickering past
// on a machine that had nothing to load.
const LANDED = ARRIVE + 1040

// The mark lifting away as the app arrives.
const GONE = 360

function stillness(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

// The first thing the app says. It opens travelling, drops out of it, and the
// crew lands on the other side: the three discs arrive the way they do
// everywhere else and the light they split spills onto the field behind them.
// Then the whole of it lifts away, once there is somewhere to be.
export default function Boot({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [still] = useState(stillness)
  const [arrived, setArrived] = useState(still)
  const [landed, setLanded] = useState(false)
  const [gone, setGone] = useState(false)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (still) {
      setLanded(true)
      return
    }
    const coming = setTimeout(() => {
      setArrived(true)
      playSound('crew.mark')
    }, ARRIVE)
    const there = setTimeout(() => setLanded(true), LANDED)
    return () => {
      clearTimeout(coming)
      clearTimeout(there)
    }
  }, [still])

  useEffect(() => {
    if (!landed || !ready) return
    setGone(true)
    const timer = setTimeout(() => done.current(), GONE)
    return () => clearTimeout(timer)
  }, [landed, ready])

  return (
    <div
      data-crew-lit
      data-gone={gone || undefined}
      className="crew-boot relative h-full overflow-hidden bg-ink-950 flex items-center justify-center"
    >
      <WarpField still={still} />
      <div className="app-drag absolute inset-0" />
      {arrived && (
        <div className="crew-boot-mark relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <CrewGlow className="w-[30rem] max-w-none shrink-0" />
          </div>
          <CrewMark className="relative w-auto text-fg" live height={72} />
        </div>
      )}
    </div>
  )
}
