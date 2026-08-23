import { memo, useState } from 'react'
import { cleanPluginName } from '../../../shared/plugins'
import { ChevronRightGlyph } from '../icons'
import { carries, stepHidden, useFindQuery } from './find'
import { resourceColor } from './fileLinks'
import PluginMark from './plugins/PluginMark'
import StepCode from './StepCode'
import { sameItem, type ThreadItem } from './thread'
import ToolCallDetail, { toolCallInfo } from './ToolCallDetail'
import type { ToolAction } from './toolActions'

function PluginStep({
  item,
  action,
  linked,
  inGroup
}: {
  item: ThreadItem
  action: ToolAction
  linked?: boolean
  inGroup?: boolean
}) {
  const [open, setOpen] = useState<boolean | null>(null)
  const detail = item.detail ?? ''
  const info = toolCallInfo(detail)
  const hasInput = info ? info.fields.length > 0 : Boolean(detail.trim())
  const hasOutput = Boolean(item.output?.trim())
  const expandable = hasInput || hasOutput
  const found = expandable && carries(useFindQuery(), stepHidden(item))
  const expanded = expandable && (open ?? found)
  const source = action.source ?? ''
  const seed = cleanPluginName(source)
  const work = item.streaming ? action.run : action.done

  return (
    <div
      className={`animate-rise ${inGroup ? '' : 'pl-13 pr-4'} py-1 select-none ${linked ? '-mt-3' : ''}`}
      style={resourceColor(item.helperSeed ?? item.agentId)}
    >
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? expanded : undefined}
        aria-label={`${source} ${work}`}
        onClick={() => expandable && setOpen(!expanded)}
        className="group flex min-w-0 max-w-full items-center gap-2 pl-2 pr-3 py-1 rounded-full border border-ink-700 bg-ink-800/60 transition-colors enabled:hover:border-ink-600 enabled:hover:bg-ink-700 disabled:cursor-default"
      >
        <span className={item.streaming ? 'flex pulse-soft' : 'flex'}>
          <PluginMark seed={seed} box={20} />
        </span>
        <span className="max-w-[16rem] truncate text-sm text-fg-secondary group-hover:text-fg">{source}</span>
        <span className={`shrink-0 text-xs ${item.streaming ? 'text-fg-muted' : 'text-fg-faint'}`}>{work}</span>
        {expandable && (
          <ChevronRightGlyph
            className={`h-3 w-3 shrink-0 text-fg-faint transition-transform duration-200 ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        )}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {info ? <ToolCallDetail info={info} again={!item.streaming} /> : <StepCode text={detail} />}
          {item.output && <StepCode text={item.output} />}
        </div>
      )}
    </div>
  )
}

export default memo(
  PluginStep,
  (before, after) =>
    before.linked === after.linked &&
    before.inGroup === after.inGroup &&
    before.action === after.action &&
    sameItem(before.item, after.item)
)
