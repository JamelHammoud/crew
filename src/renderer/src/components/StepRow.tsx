import { ChevronRightIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import Spinner from './Spinner'
import type { ThreadItem } from './thread'

function Marker({ running }: { running: boolean }) {
  if (running) return <Spinner size={12} className="text-fg-secondary" />
  return <span className="w-1.5 h-1.5 mx-[3px] rounded-full bg-ink-500 shrink-0" />
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRightIcon
      className={`w-3.5 h-3.5 shrink-0 text-fg-faint group-hover:text-fg-muted transition-transform duration-200 ${
        open ? 'rotate-90' : ''
      }`}
    />
  )
}

export default function StepRow({ item }: { item: ThreadItem }) {
  const [open, setOpen] = useState<boolean | null>(null)

  if (item.kind === 'tool') {
    const expanded = open ?? false
    const expandable = Boolean(item.detail)
    return (
      <div className="pl-14 animate-rise">
        <button
          onClick={() => expandable && setOpen(!expanded)}
          className={`group flex items-center gap-2.5 text-sm w-full text-left ${
            expandable ? '' : 'cursor-default'
          }`}
        >
          <Marker running={item.streaming} />
          <span className={`shrink-0 ${item.streaming ? 'text-fg-secondary' : 'text-fg-muted'}`}>
            {item.subagent ? `${item.name} (agent)` : item.name}
          </span>
          {item.detail && !expanded && (
            <span className="text-fg-faint truncate font-mono text-xs">{item.detail}</span>
          )}
        </button>
        {expanded && item.detail && (
          <p
            onClick={() => setOpen(false)}
            className="text-xs font-mono text-fg-muted leading-5 mt-2 ml-[5px] whitespace-pre-wrap break-all border-l-2 border-ink-700 pl-4 cursor-pointer"
          >
            {item.detail}
          </p>
        )}
      </div>
    )
  }

  const expanded = open ?? item.streaming
  return (
    <div className="pl-14 animate-rise">
      <button
        onClick={() => setOpen(!expanded)}
        className="group flex items-center gap-2.5 text-sm text-fg-muted hover:text-fg-secondary transition-colors"
      >
        <Marker running={item.streaming} />
        <span>Thinking</span>
        <Chevron open={expanded} />
      </button>
      {expanded && (
        <p className="text-sm text-fg-muted leading-6 mt-2 ml-[5px] whitespace-pre-wrap border-l-2 border-ink-700 pl-4 animate-pop">
          {item.text.trim()}
        </p>
      )}
    </div>
  )
}
