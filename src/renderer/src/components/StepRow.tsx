import { useState } from 'react'
import type { ThreadItem } from './thread'

function Dot({ running }: { running: boolean }) {
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${running ? 'bg-white animate-pulse' : 'bg-zinc-600'}`} />
}

export default function StepRow({ item }: { item: ThreadItem }) {
  const [open, setOpen] = useState(true)

  if (item.kind === 'tool') {
    return (
      <div className="flex items-center gap-2 text-xs pl-10">
        <Dot running={item.streaming} />
        <span className="text-zinc-300">{item.subagent ? `${item.name} (agent)` : item.name}</span>
        {item.detail && <span className="text-zinc-600 truncate">{item.detail}</span>}
      </div>
    )
  }

  const text = item.text.trim()
  return (
    <div className="pl-10">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <Dot running={item.streaming} />
        <span>Thinking</span>
        <span className="text-zinc-600">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <p className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap border-l border-zinc-800 pl-3">{text}</p>
      )}
    </div>
  )
}
