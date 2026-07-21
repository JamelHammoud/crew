import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { mentionCandidates, type PooledAgent } from '../../../shared/llm'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'

export function useMentionAutocomplete(
  value: string,
  setValue: (text: string) => void,
  inputRef: RefObject<HTMLTextAreaElement>
) {
  const agents = useCrew(s => s.agents)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const matches = useMemo(() => mentionCandidates(agents, query), [agents, query])
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0))

  const onChange = (next: string) => {
    setValue(next)
    const caret = inputRef.current?.selectionStart ?? next.length
    const match = /(?:^|\s)@([^@]*)$/.exec(next.slice(0, caret))
    setQuery(match ? match[1] : null)
    setActive(0)
  }

  const pick = (label: string) => {
    const caret = inputRef.current?.selectionStart ?? value.length
    const before = value.slice(0, caret).replace(/@[^@]*$/, `@${label} `)
    setValue(before + value.slice(caret))
    setQuery(null)
    inputRef.current?.focus()
  }

  const close = () => setQuery(null)

  const onKeyDown = (e: React.KeyboardEvent): boolean => {
    if (matches.length === 0) return false
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + delta + matches.length) % matches.length)
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return true
    }
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      e.preventDefault()
      pick(matches[activeIndex].label)
      return true
    }
    return false
  }

  return { matches, activeIndex, setActive, onChange, onKeyDown, pick, close }
}

export function MentionMenu({
  matches,
  activeIndex,
  onPick,
  onHover,
  side = 'top'
}: {
  matches: PooledAgent[]
  activeIndex: number
  onPick: (label: string) => void
  onHover: (index: number) => void
  side?: 'top' | 'bottom'
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (matches.length === 0) return null
  return (
    <div
      ref={listRef}
      className={`glass absolute ${side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 rounded-2xl p-1.5 min-w-64 max-h-56 overflow-y-auto animate-pop z-50`}
    >
      {matches.map((agent, index) => (
        <button
          key={agent.id}
          onClick={() => onPick(agent.label)}
          onMouseEnter={() => onHover(index)}
          className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
            index === activeIndex ? 'bg-white/[0.08] text-fg' : 'text-fg-secondary'
          }`}
        >
          <AgentIcon seed={agent.id} size="sm" presence={agent.status === 'offline' ? 'offline' : 'online'} />
          <span className="flex-1 truncate">@{agent.label}</span>
          <span className="text-xs text-fg-muted shrink-0">{agent.ownerName}</span>
        </button>
      ))}
    </div>
  )
}
