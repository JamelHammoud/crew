import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { MINIMIZE_AT, useBrowser } from '../state/browser'
import BrowserPanel from './BrowserPanel'

const AGAIN_WITHIN = 400
const STILL_WITHIN = 3

export default function SidePanel() {
  const open = useBrowser(s => s.open)
  const fullScreen = useBrowser(s => s.fullScreen)
  const width = useBrowser(s => s.width)
  const [dragging, setDragging] = useState(false)
  const lastRelease = useRef(0)

  const startResize = (event: ReactPointerEvent) => {
    event.preventDefault()
    if (event.timeStamp - lastRelease.current < AGAIN_WITHIN) {
      lastRelease.current = 0
      useBrowser.getState().resetWidth()
      return
    }
    setDragging(true)
    const startX = event.clientX
    const startWidth = width
    let moved = false
    const move = (e: PointerEvent) => {
      if (Math.abs(e.clientX - startX) > STILL_WITHIN) moved = true
      const asked = startWidth + startX - e.clientX
      const browser = useBrowser.getState()
      if (asked < MINIMIZE_AT) {
        if (browser.open) browser.closePanel()
        return
      }
      if (!browser.open) browser.openPanel()
      browser.setWidth(asked)
    }
    const stop = (e: PointerEvent) => {
      setDragging(false)
      lastRelease.current = moved ? 0 : e.timeStamp
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <div
      data-browser-fullscreen={open && fullScreen ? '' : undefined}
      className={
        open && fullScreen
          ? 'fixed inset-0 z-[60] overflow-hidden bg-ink-900'
          : `relative shrink-0 overflow-hidden bg-ink-900 ${open ? 'border-l border-ink-700' : ''} ${
              dragging ? '' : 'transition-[width] duration-200'
            }`
      }
      style={open && fullScreen ? undefined : { width: open ? width : 0 }}
    >
      <div className="absolute inset-y-0 left-0 h-full" style={{ width: open && fullScreen ? '100%' : width }}>
        <BrowserPanel />
      </div>
      {open && !fullScreen && (
        <div
          onPointerDown={startResize}
          className="absolute inset-y-0 left-0 w-1.5 z-10 cursor-col-resize hover:bg-fg/10 transition-colors"
        />
      )}
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </div>
  )
}
