import { ArrowTopRightOnSquareIcon, CheckCircleIcon } from '@heroicons/react/16/solid'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { emptyPresence, type PresenceSnapshot } from '../../../shared/presence'
import Badge from '../components/Badge'
import { CrewMark } from '../components/CrewMark'
import { MenuDivider, MenuItem } from '../components/Popover'
import PresenceList from '../components/PresenceList'
import { showTheme } from '../state/theme'

const LIST = 400

function Nothing({ children }: { children: string }): ReactElement {
  return <p className="px-3 py-5 text-sm text-fg-muted text-center">{children}</p>
}

function Here({ state }: { state: PresenceSnapshot }): ReactElement {
  if (!state.sharing) return <Nothing>Open Crew to start or join a session.</Nothing>
  if (!state.known) return <Nothing>Open Crew to see who is here.</Nothing>
  if (state.here.length === 0) return <Nothing>Nobody else is here.</Nothing>
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

  return (
    <div ref={boxRef} className="p-1.5">
      <div className="flex items-center px-3 pt-2 pb-1.5">
        <CrewMark className="h-3 w-auto text-fg" />
        <Badge count={waiting} className="ml-auto" />
      </div>
      <MenuDivider />
      <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: LIST }}>
        <Here state={state} />
      </div>
      <MenuDivider />
      {waiting > 0 && (
        <MenuItem
          icon={<CheckCircleIcon />}
          label={waiting === 1 ? '1 task needs review' : `${waiting} tasks need review`}
          onClick={() => window.crew.openWindow()}
        />
      )}
      <MenuItem
        icon={<ArrowTopRightOnSquareIcon />}
        label="Open Crew"
        onClick={() => window.crew.openWindow()}
      />
    </div>
  )
}
