import type { CSSProperties } from 'react'
import { STROKE, wearWeight } from '../icons/keylines'
import { TOOLBOX_CASE, TOOLBOX_OPEN, TOOLBOX_SHUT } from '../icons/toolbox'

// The toolbox with its lid on a hinge behind the box. The case is the still
// icon's own case and holds still: it closes across the top, so what comes up is
// a lid off a shut box rather than the top half of the outline leaving. The
// three pieces that move carry the shut drawing and the open one, and the
// browser walks one into the other. Like the thinking mark it draws its own
// frame instead of going through glyph(), so it has to be handed the same stroke
// at the size it is worn at, or the mark sits thinner than the buttons standing
// beside it.
const WORN = 'w-[22px] h-[22px]'

const turn = (shut: string, open: string): CSSProperties =>
  ({ '--shut': `path("${shut}")`, '--open': `path("${open}")` }) as CSSProperties

export default function ToolboxMark({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={wearWeight(STROKE, WORN)}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-state={open ? 'open' : 'shut'}
      className={`toolbox-mark ${WORN}`}
    >
      <path d={TOOLBOX_CASE} />
      <path
        className="toolbox-turn"
        d={TOOLBOX_SHUT.collar}
        style={turn(TOOLBOX_SHUT.collar, TOOLBOX_OPEN.collar)}
      />
      <path
        className="toolbox-turn"
        d={TOOLBOX_SHUT.lid}
        style={turn(TOOLBOX_SHUT.lid, TOOLBOX_OPEN.lid)}
      />
      <path
        className="toolbox-turn"
        d={TOOLBOX_SHUT.handle}
        style={turn(TOOLBOX_SHUT.handle, TOOLBOX_OPEN.handle)}
      />
    </svg>
  )
}
