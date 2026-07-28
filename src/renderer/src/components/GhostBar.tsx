import { GhostGlyph } from '../icons'
import Tooltip from './Tooltip'
import { TOP_BAR_H } from './TopBar'

// What a hidden thread says about itself, at the head of it. It stands where the
// toasts do, under the bar, and it is the jump button's twin at the other end of
// the thread: the same height and the same metrics, solid white rather than
// glass, because one is something to press and this is where you are.
export default function GhostBar() {
  return (
    <div style={{ top: TOP_BAR_H }} className="absolute left-1/2 -translate-x-1/2 z-30 animate-pop">
      <Tooltip label="Only you can see this, and none of it is written down">
        <span className="flex items-center gap-1.5 h-9 pl-3 pr-4 rounded-full bg-fg text-ink-900 text-sm font-semibold shadow-[0_10px_30px_rgb(0_0_0/0.35)] cursor-default">
          <GhostGlyph className="w-4 h-4" />
          Ghost mode
        </span>
      </Tooltip>
    </div>
  )
}
