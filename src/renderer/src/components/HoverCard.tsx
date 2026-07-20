import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const CARD_WIDTH = 240

let closeActive: (() => void) | null = null

export default function HoverCard({ content, children }: { content: ReactNode; children: ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)
  const enterTimer = useRef<number | null>(null)
  const leaveTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
      if (closeActive === hide) closeActive = null
    }
  }, [hide])

  useEffect(() => {
    if (!pos) return
    window.addEventListener('scroll', hide, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', hide, { capture: true })
  }, [pos, hide])

  const hideRef = useRef<() => void>(() => {})
  const hide = useRef(() => hideRef.current()).current
  hideRef.current = () => {
    if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    if (closeActive === hide) closeActive = null
    setPos(null)
  }

  const enter = () => {
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    enterTimer.current = window.setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      if (closeActive && closeActive !== hide) closeActive()
      closeActive = hide
      setPos({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - CARD_WIDTH - 8)),
        bottom: window.innerHeight - rect.top + 8
      })
    }, 300)
  }

  const leave = () => {
    if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
    leaveTimer.current = window.setTimeout(hide, 150)
  }

  return (
    <span className="inline-block" ref={anchorRef} onMouseEnter={enter} onMouseLeave={leave}>
      {children}
      {pos &&
        createPortal(
          <div
            onMouseEnter={enter}
            onMouseLeave={leave}
            className="glass fixed z-50 rounded-2xl p-3 animate-pop cursor-default"
            style={{ left: pos.left, bottom: pos.bottom, width: CARD_WIDTH }}
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  )
}
