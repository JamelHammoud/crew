import { DocumentTextIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { docCandidates, type DocRef } from '../../../shared/docs'
import { mentionCandidates, type PooledAgent } from '../../../shared/llm'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'

export type MentionItem = { kind: 'agent'; agent: PooledAgent } | { kind: 'doc'; doc: DocRef }

type Query = { trigger: '@' | '#'; text: string }

export function useMentionAutocomplete(
  value: string,
  setValue: (text: string) => void,
  inputRef: RefObject<HTMLTextAreaElement>
) {
  const agents = useCrew(s => s.agents)
  const docs = useCrew(s => s.docs)
  const [query, setQuery] = useState<Query | null>(null)
  const [active, setActive] = useState(0)
  const matches = useMemo<MentionItem[]>(() => {
    if (query?.trigger === '@') return mentionCandidates(agents, query.text).map(agent => ({ kind: 'agent', agent }))
    if (query?.trigger === '#') return docCandidates(docs, query.text).map(doc => ({ kind: 'doc', doc }))
    return []
  }, [agents, docs, query])
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0))

  const onChange = (next: string) => {
    setValue(next)
    const caret = inputRef.current?.selectionStart ?? next.length
    const match = /(?:^|\s)([@#])([^@#]*)$/.exec(next.slice(0, caret))
    setQuery(match ? { trigger: match[1] as Query['trigger'], text: match[2] } : null)
    setActive(0)
  }

  const pick = (item: MentionItem) => {
    const caret = inputRef.current?.selectionStart ?? value.length
    const token = item.kind === 'agent' ? `@${item.agent.label}` : `#${item.doc.title}`
    const before = value.slice(0, caret).replace(/[@#][^@#]*$/, `${token} `)
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
      pick(matches[activeIndex])
      return true
    }
    return false
  }

  return { matches, activeIndex, setActive, onChange, onKeyDown, pick, close }
}

export function AgentRow({
  agent,
  active = false,
  onClick,
  onMouseEnter
}: {
  agent: PooledAgent
  active?: boolean
  onClick: () => void
  onMouseEnter?: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
        active ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:bg-fg/[0.08] hover:text-fg'
      }`}
    >
      <AgentIcon seed={agent.id} size="sm" presence={agent.status === 'offline' ? 'offline' : 'online'} />
      <span className="flex-1 truncate">@{agent.label}</span>
      <span className="text-xs text-fg-muted shrink-0">{agent.ownerName}</span>
    </button>
  )
}

function DocRow({
  doc,
  active,
  onClick,
  onMouseEnter
}: {
  doc: DocRef
  active: boolean
  onClick: () => void
  onMouseEnter: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
        active ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:bg-fg/[0.08] hover:text-fg'
      }`}
    >
      <DocumentTextIcon className="w-4 h-4 shrink-0 text-sky-300 light:text-sky-700" />
      <span className="flex-1 truncate">#{doc.title}</span>
    </button>
  )
}

export function MentionMenu({
  matches,
  activeIndex,
  onPick,
  onHover,
  side = 'top'
}: {
  matches: MentionItem[]
  activeIndex: number
  onPick: (item: MentionItem) => void
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
      {matches.map((item, index) =>
        item.kind === 'agent' ? (
          <AgentRow
            key={item.agent.id}
            agent={item.agent}
            active={index === activeIndex}
            onClick={() => onPick(item)}
            onMouseEnter={() => onHover(index)}
          />
        ) : (
          <DocRow
            key={item.doc.page}
            doc={item.doc}
            active={index === activeIndex}
            onClick={() => onPick(item)}
            onMouseEnter={() => onHover(index)}
          />
        )
      )}
    </div>
  )
}
