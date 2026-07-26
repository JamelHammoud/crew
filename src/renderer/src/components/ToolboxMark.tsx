import type { CSSProperties } from 'react'
import { STROKE, wearWeight } from '../icons/keylines'
import { TOOLBOX_BODY, TOOLBOX_HANDLE, TOOLBOX_HINGE, TOOLBOX_LID, TOOLBOX_SWING } from '../icons/objects'

// The toolbox drawn from the same three paths ToolboxGlyph is, with the lid on a
// hinge. Like the thinking mark it draws its own frame instead of going through
// glyph(), so it has to be handed the same stroke at the size it is worn at, or
// the mark sits thinner than the buttons standing beside it.
const WORN = 'w-[22px] h-[22px]'

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
      style={
        {
          '--hinge': `${TOOLBOX_HINGE.x}px ${TOOLBOX_HINGE.y}px`,
          '--swing': `${TOOLBOX_SWING}deg`
        } as CSSProperties
      }
      className={`toolbox-mark ${WORN}`}
    >
      <path d={TOOLBOX_BODY} />
      <g className="toolbox-lid">
        <path d={TOOLBOX_LID} />
        <path d={TOOLBOX_HANDLE} />
      </g>
    </svg>
  )
}
