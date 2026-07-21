import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { mentionCandidates } from '../../../shared/llm'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'

export interface MentionPicker {
  onChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent) => boolean
  close: () => void
  menu: ReactNode
}

export function useMentionPicker(
  text: string,
  setText: (value: string) => void,
  inputRef: RefObject<HTMLTextAreaElement>
): MentionPicker {
  const agents = useCrew(s => s.agents)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const matches = useMemo(() => mentionCandidates(agents, query), [agents, query])
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0))

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const onChange = (value: string) => {
    setText(value)
    const caret = inputRef.current?.selectionStart ?? value.length
    const match = /(?:^|\s)@([^@]*)$/.exec(value.slice(0, caret))
    setQuery(match ? match[1] : null)
    setActive(0)
  }

  const pick = (label: string) => {
    const caret = inputRef.current?.selectionStart ?? text.length
    const before = text.slice(0, caret).replace(/@[^@]*$/, `@${label} `)
    setText(before + text.slice(caret))
    setQuery(null)
    inputRef.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent): boolean => {
    if (matches.length === 0) return false
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + delta + matches.length) % matches.length)
      return true
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setQuery(null)
      return true
    }
    if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
      event.preventDefault()
      pick(matches[activeIndex].label)
      return true
    }
    return false
  }

  const menu =
    matches.length > 0 ? (
      <div
        ref={listRef}
        className="glass absolute bottom-full mb-2 left-0 rounded-2xl p-1.5 min-w-64 max-h-56 overflow-y-auto animate-pop z-50"
      >
        {matches.map((agent, index) => (
          <button
            key={agent.id}
            onClick={() => pick(agent.label)}
            onMouseEnter={() => setActive(index)}
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
    ) : null

  return { onChange, onKeyDown, close: () => setQuery(null), menu }
}
