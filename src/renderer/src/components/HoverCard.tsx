import { useEffect, useRef, useState, type ReactNode } from 'react'

export default function HoverCard({ content, children }: { content: ReactNode; children: ReactNode }) {
  const [show, setShow] = useState(false)
  const enterTimer = useRef<number | null>(null)
  const leaveTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    }
  }, [])

  const enter = () => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    enterTimer.current = window.setTimeout(() => setShow(true), 300)
  }

  const leave = () => {
    if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
    leaveTimer.current = window.setTimeout(() => setShow(false), 150)
  }

  return (
    <span className="relative inline-block" onMouseEnter={enter} onMouseLeave={leave}>
      {children}
      {show && (
        <span className="glass absolute bottom-full left-0 mb-2 z-50 block w-60 rounded-2xl p-3 animate-pop cursor-default">
          {content}
        </span>
      )}
    </span>
  )
}
