import { useEffect, useRef, useState, type ReactElement } from 'react'
import { emptyPresence, type PresenceSnapshot } from '../../../shared/presence'
import { MenuDivider, MenuItem } from '../components/Popover'
import PresenceList from '../components/PresenceList'
import { ChatGlyph, CheckCircleGlyph, StickyGlyph } from '../icons'
import { showTheme } from '../state/theme'

const LIST = 388

function Nothing({ children }: { children: string }): ReactElement {
  return <p className="px-3 py-4 text-sm text-fg/45 text-center">{children}</p>
}

function Here({ state }: { state: PresenceSnapshot }): ReactElement | null {
  if (!state.sharing || !state.known) return null
  if (state.here.length === 0) return <Nothing>Just you here.</Nothing>
  return <PresenceList here={state.here} />
}

export default function TrayPanel(): ReactElement {
  const [state, setState] = useState<PresenceSnapshot>(emptyPresence)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => window.crew.onPresence(setState), [])
  useEffect(() => window.crew.onTrayTheme(showTheme), [])

  // The window is only ever as tall as what it holds, so the panel measures
  // itself and the menu bar side resizes to match.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(() => window.crew.resizeTray(box.offsetHeight))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.crew.closeTray()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const waiting = state.waiting
  const hasPresence = state.sharing && state.known

  return (
    <div
      ref={boxRef}
      className="w-full max-w-full overflow-x-hidden p-1.5 [&_button]:focus-visible:bg-fg/5 [&_button]:focus-visible:text-fg [&_button]:focus-visible:outline-none"
    >
      <MenuItem icon={<ChatGlyph />} label="Open chat" onClick={() => window.crew.openChat()} />
      {waiting > 0 && (
        <MenuItem
          icon={<CheckCircleGlyph />}
          label={waiting === 1 ? 'Review 1 task' : `Review ${waiting} tasks`}
          onClick={() => window.crew.openWindow()}
        />
      )}
      <MenuItem icon={<StickyGlyph />} label="New sticky" onClick={() => void window.crew.openStickies()} />
      {hasPresence && <MenuDivider />}
      {hasPresence && (
        <div className="-mx-1.5 overflow-x-hidden overflow-y-auto px-1.5" style={{ maxHeight: LIST }}>
          <Here state={state} />
        </div>
      )}
    </div>
  )
}
