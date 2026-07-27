import { useEffect, useRef } from 'react'

// A frame that is worth what it really took, capped: a window left in the
// background hands back one enormous step when it comes round again, and a bird
// moved by a second and a half of gravity in one go is a bird already in the
// ground before anyone can press anything.
const LONGEST = 1 / 20

export default function useGameLoop(frame: (dt: number) => void, running: boolean): void {
  const held = useRef(frame)
  held.current = frame

  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, LONGEST)
      last = now
      held.current(dt)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [running])
}
