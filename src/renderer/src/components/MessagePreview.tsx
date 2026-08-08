import { useLayoutEffect, useRef, useState } from 'react'
import type { AgentMentionRef } from '../../../shared/llm'
import { MentionText } from './Mention'

// So many lines of what somebody wrote, and an ellipsis where it was cut.
//
// The cut is taken line by line rather than by a height on the box, and that is
// the whole of why this is not a `max-height`. A blank line is a line like any
// other to a clamp, so the cut lands on one often enough, and what is left is a
// preview ending in an empty row with the gap under it standing where the rest
// of the message should be. Worse, an ellipsis drawn on that row is three dots
// alone on a blank line. Here a blank line at the cut is dropped and the
// ellipsis lands at the end of real words, which is the one thing that says
// there is more without saying anything.
//
// Nothing about the message is rewritten for it. The blank lines inside what is
// shown are the ones that were written, since collapsing them is the app
// deciding it knows better than whoever typed it.

type Fit = { upTo: number; room: number; more: boolean }

// Every row is a box that can be clamped, so the last one shown can be cut at a
// line of its own rather than by the edge of a box drawn over it.
const ROW = 'preview-line block whitespace-pre-wrap break-words overflow-hidden [-webkit-box-orient:vertical]'

function fitOf(own: number[], blank: boolean[], lines: number): Fit {
  let left = lines
  let upTo = -1
  let room = 0
  for (let i = 0; i < own.length && left > 0; i++) {
    upTo = i
    room = Math.min(own[i], left)
    left -= own[i]
  }
  if (upTo < 0) return { upTo, room, more: own.length > 0 }
  // A blank line at the cut is the gap this exists to take out.
  while (upTo > 0 && blank[upTo]) {
    upTo--
    room = own[upTo]
  }
  // Only words left out are worth an ellipsis. Blank lines running off the end
  // are nothing anybody is missing.
  const rest = blank.slice(upTo + 1).some(empty => !empty)
  return { upTo, room, more: rest || room < own[upTo] }
}

export default function MessagePreview({
  text,
  mentionRefs,
  lines,
  className = ''
}: {
  text: string
  mentionRefs?: AgentMentionRef[]
  lines: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const [open, setOpen] = useState(false)
  const written = text.split('\n')

  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return

    const lay = () => {
      const rows = Array.from(box.children) as HTMLElement[]
      if (!rows.length) return
      for (const row of rows) {
        row.style.removeProperty('display')
        row.style.removeProperty('-webkit-line-clamp')
        row.removeAttribute('data-more')
      }
      const lh = parseFloat(getComputedStyle(box).lineHeight) || 1
      const own = rows.map(row => Math.max(1, Math.round(row.offsetHeight / lh)))
      const blank = rows.map(row => (row.textContent ?? '').trim() === '')
      const fit = fitOf(own, blank, lines)
      setMore(fit.more)
      if (open) return
      rows.forEach((row, i) => {
        if (i > fit.upTo) {
          row.style.display = 'none'
          return
        }
        if (i < fit.upTo) return
        if (fit.room < own[i]) {
          row.style.display = '-webkit-box'
          row.style.setProperty('-webkit-line-clamp', String(fit.room))
        }
        if (fit.more) row.setAttribute('data-more', '')
      })
    }

    lay()
    // Only a change of width is worth laying out again. Our own writes change
    // the height, so a watch on that is a watch on ourselves.
    let was = box.clientWidth
    const watching = new ResizeObserver(() => {
      if (box.clientWidth === was) return
      was = box.clientWidth
      lay()
    })
    watching.observe(box)
    return () => watching.disconnect()
  }, [lines, text, mentionRefs, open])

  return (
    <div className={className}>
      <div ref={ref} className="select-text">
        {written.map((line, index) => (
          <span key={index} className={line === '' ? `${ROW} h-[1lh]` : ROW}>
            <MentionText text={line} mentionRefs={mentionRefs} />
          </span>
        ))}
      </div>
      {more && (
        <button
          onClick={() => setOpen(was => !was)}
          className="mt-1 text-sm text-fg-secondary transition-colors duration-150 hover:text-fg"
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
