import { useState } from 'react'
import type { ThreadItem } from './thread'

function Dot({ running }: { running: boolean }) {
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${running ? 'bg-white animate-pulse' : 'bg-zinc-600'}`} />
}

export default function StepRow({ item }: { item: ThreadItem }) {
  const [open, setOpen] = useState(false)

  if (item.kind === 'tool') {
    return (
      <div className="flex items-center gap-2 text-xs pl-10">
        <Dot running={item.streaming} />
        <span className="text-zinc-300">{item.subagent ? `${item.name} (agent)` : item.name}</span>
        {item.detail && <span className="text-zinc-600 truncate">{item.detail}</span>}
      </div>
    )
  }

  const lines = item.text.trim().split('\n')
  return (
    <div className="pl-10">
      <button onClick={() => setOpen(!open)} className="text-left w-full group">
        <div className="flex items-center gap-2 text-xs">
          <Dot running={item.streaming} />
          <span className="text-zinc-500 group-hover:text-zinc-400">Thinking</span>
        </div>
        <p className={`text-xs text-zinc-500 mt-1 whitespace-pre-wrap ${open ? '' : 'line-clamp-2'}`}>
          {open ? item.text.trim() : lines[0]}
        </p>
      </button>
    </div>
  )
}
