import { useRef, useState } from 'react'
import { playSound } from '../media/sounds'
import { CrewMark } from './CrewMark'

const ONCE = new Set(['crew-join', 'crew-flash'])

export default function CrewLogo({ className = '', height = 18 }: { className?: string; height?: number }) {
  const [lit, setLit] = useState(false)
  const box = useRef<HTMLButtonElement>(null)
  const over = useRef(false)

  const strike = () => {
    for (const animation of box.current?.getAnimations?.({ subtree: true }) ?? []) {
      if (!ONCE.has((animation as CSSAnimation).animationName)) continue
      animation.cancel()
      animation.play()
    }
    playSound('crew.mark')
  }

  return (
    <button
      ref={box}
      type="button"
      aria-label="Crew"
      data-crew-lit={lit || undefined}
      onPointerEnter={() => {
        if (over.current) return
        over.current = true
        setLit(true)
        strike()
      }}
      onPointerLeave={() => {
        over.current = false
        setLit(false)
      }}
      onClick={strike}
      className={`crew-logo app-no-drag flex items-center rounded-full px-1.5 py-2 transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/20 ${className}`}
    >
      <CrewMark className="w-auto text-fg" live height={18} />
    </button>
  )
}
