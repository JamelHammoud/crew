import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useBrowser } from '../state/browser'
import BrowserPanel from './BrowserPanel'

export default function SidePanel() {
  const open = useBrowser(s => s.open)
  const width = useBrowser(s => s.width)
  const [dragging, setDragging] = useState(false)

  const startResize = (event: ReactPointerEvent) => {
    event.preventDefault()
    setDragging(true)
    const startX = event.clientX
    const startWidth = width
    const move = (e: PointerEvent) => useBrowser.getState().setWidth(startWidth + startX - e.clientX)
    const stop = () => {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-ink-900 ${open ? 'border-l border-ink-700' : ''} ${
        dragging ? '' : 'transition-[width] duration-200'
      }`}
      style={{ width: open ? width : 0 }}
    >
      <div className="absolute inset-y-0 left-0 h-full" style={{ width }}>
        <BrowserPanel />
      </div>
      {open && (
        <div
          onPointerDown={startResize}
          className="absolute inset-y-0 left-0 w-1.5 z-10 cursor-col-resize hover:bg-fg/10 transition-colors"
        />
      )}
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </div>
  )
}
