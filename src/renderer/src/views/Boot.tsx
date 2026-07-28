import { useEffect, useRef, useState } from 'react'
import { CrewGlow, CrewMark } from '../components/CrewMark'
import { playSound } from '../media/sounds'

// How long the three discs take to arrive and the light to finish crossing
// them. The boot holds for at least that, so the mark lands rather than
// flickering past on a machine that had nothing to load.
const LANDED = 980

// The mark lifting away as the app arrives.
const GONE = 340

// The first thing the app says. The three discs arrive the way they do
// everywhere else, the light they split spills onto the surface behind them,
// and the whole of it lifts away once there is somewhere to be.
export default function Boot({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [landed, setLanded] = useState(false)
  const [gone, setGone] = useState(false)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    playSound('crew.mark')
    const timer = setTimeout(() => setLanded(true), LANDED)
    return () => clearTimeout(timer)
  }, [])

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
      className="crew-boot relative h-full overflow-hidden flex items-center justify-center"
    >
      <div className="app-drag absolute inset-0" />
      <div className="crew-boot-mark relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <CrewGlow className="w-[34rem] max-w-none shrink-0" />
        </div>
        <CrewMark className="relative w-auto text-fg" live height={64} />
      </div>
    </div>
  )
}
