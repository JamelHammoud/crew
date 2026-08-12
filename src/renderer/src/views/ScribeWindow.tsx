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
  useEffect(() => window.crew.onScribeHeld(useScribe.getState().holding), [])

  // The window is only ever as big as what it holds, the way the tray panel is,
  // and both ways round rather than only in height: the pill stands over
  // somebody else's work the whole time dictation is on, so every pixel of
  // window past the pill is a click of theirs that goes nowhere.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(() => window.crew.resizeScribe(box.offsetWidth, box.offsetHeight))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  // Escape is the way out of whatever is on screen. A card of held words is words
  // and nothing else, so it lets go of them rather than cancelling a dictation
  // that is already over.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const scribe = useScribe.getState()
      if (scribe.held) scribe.letGo()
      else scribe.cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={boxRef} className="w-fit">
      <ScribePill />
    </div>
  )
}
