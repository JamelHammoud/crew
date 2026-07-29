import { useState } from 'react'
import Counts from './Counts'
import { carries, stepText, useFindQuery } from './find'
import StepRow, { Chevron, Label, Mark, rowClass, stepFiles, stepTotals } from './StepRow'
import type { ThreadItem } from './thread'
import { toolAction } from './toolActions'

export default function StepGroup({ items, linked }: { items: ThreadItem[]; linked?: boolean }) {
  const [open, setOpen] = useState<boolean | null>(null)
  const action = toolAction(items[0].name, items[0].subagent)
  const live = items.some(item => item.streaming)
  const found = carries(useFindQuery(), items.flatMap(stepText))
  const expanded = open ?? (found || live)
  const totals = stepTotals(items.flatMap(stepFiles))

  return (
    <div className={`pl-14 animate-rise ${linked ? '-mt-3' : ''}`}>
      <button onClick={() => setOpen(!expanded)} className={rowClass(true)}>
        <Mark icon={action.icon} running={live} />
        {live ? (
          <Label action={action} running />
        ) : (
          <span className="shrink-0 text-fg-muted group-hover:text-fg-secondary transition-colors">
            {action.many ?? action.done}
          </span>
        )}
        <Counts added={totals.added} removed={totals.removed} className="mono-inline" />
        <Chevron open={expanded} />
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {items.map(item => (
            <StepRow key={item.key} item={item} inGroup />
          ))}
        </div>
      )}
    </div>
  )
}
