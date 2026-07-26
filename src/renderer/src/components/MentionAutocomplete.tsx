import { DocumentTextIcon } from '@heroicons/react/16/solid'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { docCandidates, type DocRef } from '../../../shared/docs'
import { mentionCandidates, type PooledAgent } from '../../../shared/llm'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import Emoji from './Emoji'
import { emojiForShortcode, searchEmoji, type EmojiEntry } from './emojiData'
import { rememberEmoji } from './emojiRecents'

export type MentionItem =
  | { kind: 'agent'; agent: PooledAgent }
  | { kind: 'doc'; doc: DocRef }
  | { kind: 'emoji'; entry: EmojiEntry }

type Query = { trigger: '@' | '#' | ':'; text: string }

const MENTION_QUERY = /(?:^|\s)([@#])([^@#]*)$/
const EMOJI_QUERY = /(?:^|\s):([A-Za-z0-9_+-]{2,})$/
const EMOJI_CLOSED = /(?:^|\s):([A-Za-z0-9_+-]+):$/
const EMOJI_TAIL = /:[A-Za-z0-9_+-]*$/
const EMOJI_MATCHES = 9

export function useMentionAutocomplete(
  value: string,
  setValue: (text: string) => void,
  inputRef: RefObject<HTMLTextAreaElement>
) {
  const agents = useCrew(s => s.agents)
  const docs = useCrew(s => s.docs)
  const [query, setQuery] = useState<Query | null>(null)
  const [active, setActive] = useState(0)
  const caretTarget = useRef<number | null>(null)
  const matches = useMemo<MentionItem[]>(() => {
    if (query?.trigger === '@') return mentionCandidates(agents, query.text).map(agent => ({ kind: 'agent', agent }))
    if (query?.trigger === '#') return docCandidates(docs, query.text).map(doc => ({ kind: 'doc', doc }))
    if (query?.trigger === ':')
      return searchEmoji(query.text, EMOJI_MATCHES).map(entry => ({ kind: 'emoji', entry }))
    return []
  }, [agents, docs, query])
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0))

  const onChange = (next: string) => {
    const caret = inputRef.current?.selectionStart ?? next.length
    const head = next.slice(0, caret)
    const closed = EMOJI_CLOSED.exec(head)
    const char = closed && emojiForShortcode(closed[1])
    if (char) {
      const before = head.slice(0, head.length - closed[1].length - 2) + char
      caretTarget.current = before.length
      setValue(before + next.slice(caret))
      rememberEmoji(char)
      setQuery(null)
      setActive(0)
      return
    }
    setValue(next)
    const mention = MENTION_QUERY.exec(head)
    const emoji = EMOJI_QUERY.exec(head)
    if (mention) setQuery({ trigger: mention[1] as Query['trigger'], text: mention[2] })
    else setQuery(emoji ? { trigger: ':', text: emoji[1] } : null)
    setActive(0)
  }

  useLayoutEffect(() => {
    const target = caretTarget.current
    const input = inputRef.current
    if (target === null || !input) return
    caretTarget.current = null
    input.focus()
    input.setSelectionRange(target, target)
  }, [inputRef, value])

  const pick = (item: MentionItem) => {
    const caret = inputRef.current?.selectionStart ?? value.length
    if (item.kind === 'emoji') rememberEmoji(item.entry.char)
    const token =
      item.kind === 'agent' ? `@${item.agent.label}` : item.kind === 'doc' ? `#${item.doc.title}` : item.entry.char
    const before = value
      .slice(0, caret)
      .replace(item.kind === 'emoji' ? EMOJI_TAIL : /[@#][^@#]*$/, token)
    const after = value.slice(caret)
    const gap = after.startsWith(' ') ? '' : ' '
    caretTarget.current = before.length + 1
    setValue(before + gap + after)
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

function EmojiRow({
  entry,
  active,
  onClick,
  onMouseEnter
}: {
  entry: EmojiEntry
  active: boolean
  onClick: () => void
  onMouseEnter: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      aria-label={`:${entry.shortName}:`}
      className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
        active ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:bg-fg/[0.08] hover:text-fg'
      }`}
    >
      <Emoji char={entry.char} size={18} />
      <span className="flex-1 truncate">:{entry.shortName}:</span>
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
