import { useEffect, useRef } from 'react'
import ScribePill from '../components/scribe/ScribePill'
import { useScribe } from '../state/scribe'

// The whole of what the pill's window holds. It never connects to the session:
// this window is one machine talking to its own microphone, and a dictation is
// nobody else's business.
export default function ScribeWindow() {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scribe = useScribe.getState()
    return window.crew.onScribe(word => {
      if (word === 'arm') void scribe.arm()
      else if (word === 'finish') void scribe.finish()
      else scribe.cancel()
    })
  }, [])

  useEffect(() => window.crew.onScribeSettings(useScribe.getState().apply), [])
  useEffect(() => window.crew.onScribeProblem(useScribe.getState().said), [])

  // The window is only ever as tall as what it holds, the way the tray panel is.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(() => window.crew.resizeScribe(box.offsetHeight))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') useScribe.getState().cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={boxRef}>
      <ScribePill />
    </div>
  )
}
