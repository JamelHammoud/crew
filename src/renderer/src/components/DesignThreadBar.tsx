import { useState } from 'react'
import { relabelMentions, type PooledAgent } from '../../../shared/llm'
import { ChevronDownGlyph, PlusGlyph } from '../icons'
import { useCrew, type ThreadMeta } from '../state/store'
import AgentIcon from './AgentIcon'
import { PanelButton } from './DesignControls'
import { MenuItem, Popover } from './Popover'
import { stripMention } from './thread'

// The pet in front of the name says which agent it is, so the name it was
// started with does not have to say it again.
export function threadName(thread: ThreadMeta, agents: Array<Pick<PooledAgent, 'id' | 'label'>>): string {
  const written = relabelMentions(thread.title, thread.titleRefs, agents)
  return stripMention(written, thread.agentLabel) || 'Untitled'
}

export default function DesignThreadBar({
  threads,
  current,
  onPick,
  onNew
}: {
  threads: ThreadMeta[]
  current: string | null
  onPick: (id: string) => void
  onNew: () => void
}) {
  const agents = useCrew(s => s.agents)
  const [open, setOpen] = useState(false)
  const thread = threads.find(item => item.id === current)
  const label = thread ? threadName(thread, agents) : 'New thread'
  // The pet is handed a flex box of its own rather than the row's alignment: it
  // stands at the top of whatever holds it, which in a row of one line is six
  // pixels above the name beside it.
  const mark = thread ? (
    <span className="flex shrink-0 items-center">
      <AgentIcon seed={thread.agentId} size="xs" />
    </span>
  ) : null

  return (
    <div className="h-12 shrink-0 flex items-center gap-1 pl-2 pr-2">
      <div className="relative flex-1 min-w-0">
        {threads.length > 1 || !thread ? (
          <button
            onClick={() => setOpen(true)}
            aria-label="Pick a thread"
            className="w-full h-8 flex items-center gap-2 rounded-full pl-1 pr-2.5 transition-colors hover:bg-fg/[0.06]"
          >
            {mark}
            <Name text={label} />
            <ChevronDownGlyph className="w-3.5 h-3.5 shrink-0 text-fg-muted" />
          </button>
        ) : (
          <div className="h-8 flex items-center gap-2 pl-1 pr-2.5">
            {mark}
            <Name text={label} />
          </div>
        )}
        <Popover open={open} onClose={() => setOpen(false)} align="start" className="w-64">
          {threads.map(item => (
            <MenuItem
              key={item.id}
              icon={<AgentIcon seed={item.agentId} size="xs" />}
              label={threadName(item, agents)}
              checked={item.id === current}
              onClick={() => {
                onPick(item.id)
                setOpen(false)
              }}
            />
          ))}
        </Popover>
      </div>
      <PanelButton label="New thread" onClick={onNew}>
        <PlusGlyph className="w-4 h-4" />
      </PanelButton>
    </div>
  )
}

function Name({ text }: { text: string }) {
  return <span className="flex-1 min-w-0 truncate text-left text-xs font-semibold text-fg-secondary">{text}</span>
}
