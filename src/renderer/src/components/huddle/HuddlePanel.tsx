import { problemText, useHuddle } from '../../state/huddle'
import AudioStream from './AudioStream'
import HuddleBanner from './HuddleBanner'
import HuddleDock, { DOCK_SIZE } from './HuddleDock'
import HuddleStage from './HuddleStage'
import ScreenPicker from './ScreenPicker'
import { useDockPosition } from './useDockPosition'

function Problem() {
  const problem = useHuddle(s => s.problem)
  const clearProblem = useHuddle(s => s.clearProblem)
  const openSettings = useHuddle(s => s.openSettings)
  if (!problem) return null

  return (
    <div className="fixed left-1/2 -translate-x-1/2 top-[86px] z-[60] animate-rise">
      <div className="glass rounded-full pl-4 pr-2 py-2 flex items-center gap-3">
        <span className="text-sm text-fg-secondary">{problemText(problem)}</span>
        <button
          onClick={openSettings}
          className="h-8 px-3.5 rounded-full text-sm font-semibold bg-fg text-ink-900 transition-all duration-150 hover:bg-fg/90 active:scale-95"
        >
          Open settings
        </button>
        <button
          onClick={clearProblem}
          className="h-8 px-3 rounded-full text-sm font-medium text-fg-muted hover:text-fg hover:bg-fg/[0.06] transition-colors active:scale-95"
        >
          Not now
        </button>
      </div>
    </div>
  )
}

export default function HuddlePanel() {
  const joined = useHuddle(s => s.joined)
  const expanded = useHuddle(s => s.expanded)
  const picking = useHuddle(s => s.picking)
  const remote = useHuddle(s => s.remote)
  const dock = useDockPosition(DOCK_SIZE)

  return (
    <>
      {joined &&
        Object.entries(remote).map(([peerId, streams]) => (
          <AudioStream key={peerId} stream={streams.mic} />
        ))}
      {joined && (expanded ? <HuddleStage /> : <HuddleDock {...dock} onGrab={dock.onGrab} />)}
      {!joined && <HuddleBanner />}
      {picking && <ScreenPicker />}
      <Problem />
    </>
  )
}
