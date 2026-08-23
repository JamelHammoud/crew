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
  const verb = item.streaming ? 'Using' : 'Used'
  const work = item.streaming ? action.run : action.done

  return (
    <div
      className={`animate-rise ${inGroup ? '' : 'pl-14'} ${linked ? '-mt-3' : ''}`}
      style={resourceColor(item.helperSeed ?? item.agentId)}
    >
      <div className="overflow-hidden rounded-card border border-ink-700 bg-ink-850">
        <button
          onClick={() => expandable && setOpen(!expanded)}
          className={`group flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm select-none transition-colors ${
            expandable ? '' : 'cursor-default'
          }`}
        >
          <PluginMark seed={seed} box={24} />
          <span
            className={`shrink-0 transition-colors ${
              item.streaming ? 'text-fg' : 'text-fg-secondary group-hover:text-fg'
            }`}
          >
            {`${verb} ${source}`}
          </span>
          <span className="min-w-0 truncate text-xs text-fg-muted">{work}</span>
          {expandable && (
            <ChevronRightGlyph
              className={`ml-auto h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform duration-200 ${
                expanded ? 'rotate-90' : ''
              }`}
            />
          )}
        </button>
        {expanded && (
          <div className="space-y-2 border-t border-ink-700 p-2">
            {info ? <ToolCallDetail info={info} again={!item.streaming} embedded /> : <StepCode text={detail} />}
            {item.output && <StepCode text={item.output} />}
          </div>
        )}
      </div>
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
