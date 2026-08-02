import { useEffect, useRef, useState } from 'react'

const FLOOR = 120
const SCRIM = 16

export function useComposerRoom() {
  const ref = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState(FLOOR)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => setRoom(Math.max(FLOOR, el.offsetHeight - SCRIM)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, room }
}
