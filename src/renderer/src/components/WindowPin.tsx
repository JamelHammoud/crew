import { useState } from 'react'
import { PinGlyph } from '../icons'
import { setWindowPinned, useWindowPinned } from '../state/windowShape'
import Tooltip from './Tooltip'

export default function WindowPin() {
  const pinned = useWindowPinned()
  const [busy, setBusy] = useState(false)
  const label = pinned ? 'Stop keeping on top' : 'Keep on top'

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    try {
      setWindowPinned(await window.crew.setWindowPinned(!pinned))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-label={label}
        aria-pressed={pinned}
        className={`app-no-drag w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 disabled:pointer-events-none ${
          pinned ? 'bg-fg/[0.1] text-fg hover:bg-fg/[0.14]' : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
        }`}
      >
        <PinGlyph className="w-[18px] h-[18px]" />
      </button>
    </Tooltip>
  )
}
