import { useState } from 'react'
import { playSound } from '../media/sounds'
import { CrewMark } from './CrewMark'

export default function CrewLogo({ className = '' }: { className?: string }) {
  const [lit, setLit] = useState(false)
  const [run, setRun] = useState(0)

  const strike = () => {
    setRun(count => count + 1)
    playSound('crew.mark')
  }

  return (
    <button
      type="button"
      aria-label="Crew"
      data-lit={lit || undefined}
      onPointerEnter={() => {
        setLit(true)
        strike()
      }}
      onPointerLeave={() => setLit(false)}
      onClick={strike}
      className={`crew-logo app-no-drag flex items-center rounded-full px-1 py-1.5 transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20 ${className}`}
    >
      <CrewMark className="h-[18px] w-auto text-fg" run={run} />
    </button>
  )
}
