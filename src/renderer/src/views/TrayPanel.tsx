import { useEffect, useRef, useState, type ReactElement } from 'react'
import { emptyPresence, type PresenceSnapshot } from '../../../shared/presence'
import Badge from '../components/Badge'
import { CrewMark } from '../components/CrewMark'
import PresenceList from '../components/PresenceList'
import { CheckCircleGlyph, ChevronRightGlyph, LeaveGlyph, WindowGlyph } from '../icons'
import { showTheme } from '../state/theme'

const LIST = 344

function Nothing({ children }: { children: string }): ReactElement {
  return <p className="px-3 py-4 text-sm text-fg/45 text-center">{children}</p>
}

function Here({ state }: { state: PresenceSnapshot }): ReactElement | null {
  if (!state.sharing) return null
  if (!state.known) return <Nothing>Open Crew to see who is here.</Nothing>
  if (state.here.length === 0) return <Nothing>Just you here.</Nothing>
  return <PresenceList here={state.here} />
}

function SessionState({ sharing }: { sharing: boolean }): ReactElement {
  return (
    <span className="flex items-center gap-1.5 text-xs text-fg/45">
      <span className={`h-1.5 w-1.5 rounded-full ${sharing ? 'bg-positive' : 'bg-fg/20'}`} />
      {sharing ? 'Session open' : 'No session'}
    </span>
  )
}

function Review({ waiting }: { waiting: number }): ReactElement | null {
  if (waiting < 1) return null
  return (
    <button
      onClick={() => window.crew.openWindow()}
      className="group mx-1.5 mb-1.5 flex w-[calc(100%-12px)] items-center gap-3 rounded-xl bg-fg/[0.06] px-3 py-2.5 text-left transition-colors hover:bg-fg/[0.1] active:scale-[0.98]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fg text-ink-900">
        <CheckCircleGlyph className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-fg">
        {waiting === 1 ? 'Review 1 task' : `Review ${waiting} tasks`}
      </span>
      <ChevronRightGlyph className="h-3.5 w-3.5 shrink-0 text-fg/30 transition-colors group-hover:text-fg/60" />
    </button>
  )
}

function Actions(): ReactElement {
  return (
    <div className="flex gap-1.5 p-1.5">
      <button
        onClick={() => window.crew.openWindow()}
        className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-fg px-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-fg/90 active:scale-95"
      >
        <WindowGlyph className="h-4 w-4" />
        Open Crew
      </button>
      <button
        onClick={() => window.crew.quitCrew()}
        className="flex h-9 items-center justify-center gap-2 rounded-full px-3 text-sm text-fg/55 transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-95"
      >
        <LeaveGlyph className="h-4 w-4" />
        Quit
      </button>
    </div>
  )
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
  const hasPresence = state.sharing

  return (
    <div ref={boxRef} className="p-1.5">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <CrewMark className="h-3 w-auto text-fg" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-semibold leading-4 text-fg">Crew</p>
          <SessionState sharing={state.sharing} />
        </div>
        <Badge count={waiting} rim={false} />
      </div>
      <Review waiting={waiting} />
      {hasPresence && (
        <div className="border-y border-fg/[0.06]">
          <div className="overflow-y-auto" style={{ maxHeight: LIST }}>
            <Here state={state} />
          </div>
        </div>
      )}
      {!hasPresence && <div className="h-px bg-fg/[0.06]" />}
      <Actions />
    </div>
  )
}
