import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { SlashCommand } from '../../../shared/commands'
import { customEmojiRef, type CustomEmoji } from '../../../shared/customEmoji'
import { mentionCandidates, type PooledAgent } from '../../../shared/llm'
import { pathCandidates, pathQuery, pathToken, type PathMatch } from '../../../shared/pathMention'
import { memberMentionCandidates } from '../../../shared/people'
import type { MemberInfo } from '../../../shared/protocol'
import { crewRefs, refCandidates, type CrewRef } from '../../../shared/refs'
import { FrameGlyph } from '../design/glyphs'
import { DocGlyph, FileGlyph, FolderGlyph } from '../icons'
import { useProjectFiles } from '../state/projectFiles'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'
import { lookupCustomEmoji, searchCustomEmoji } from './customEmojiSheet'
import Emoji from './Emoji'
import { emojiForShortcode, searchEmoji, type EmojiEntry } from './emojiData'
import { rememberEmoji } from './emojiRecents'
import Marked from './Marked'

export type MentionItem =
  | { kind: 'agent'; agent: PooledAgent }
  | { kind: 'member'; member: MemberInfo }
  | { kind: 'ref'; ref: CrewRef }
  | { kind: 'emoji'; entry: EmojiEntry }
  | { kind: 'custom'; emoji: CustomEmoji }
  | { kind: 'path'; match: PathMatch }

type Query = { trigger: '@' | '#' | ':' | '/'; text: string }

const MENTION_QUERY = /(?:^|\s)([@#])([^@#]*)$/
const EMOJI_QUERY = /(?:^|\s):([A-Za-z0-9_+-]{2,})$/
const EMOJI_CLOSED = /(?:^|\s):([A-Za-z0-9_+-]+):$/
const EMOJI_TAIL = /:[A-Za-z0-9_+-]*$/
const PATH_TAIL = /\S*$/
const EMOJI_MATCHES = 9
const PATH_MATCHES = 10

export function useMentionAutocomplete(
  value: string,
  setValue: (text: string) => void,
  inputRef: RefObject<HTMLTextAreaElement>,
  { members: includeMembers = true, commands }: { members?: boolean; commands?: readonly SlashCommand[] } = {}
) {
  const agents = useCrew(s => s.agents)
  const members = useCrew(s => s.members)
  const docs = useCrew(s => s.docs)
  const boards = useCrew(s => s.boards)
  const place = useCrew(s => s.place)
  const files = useProjectFiles(s => s.index)
  const [query, setQuery] = useState<Query | null>(null)
  const [active, setActive] = useState(0)
  const caretTarget = useRef<number | null>(null)

  // The list is read once for the window rather than on the keystroke that
  // wants it, so the first menu arrives with the word rather than after it.
  useEffect(() => {
    useProjectFiles.getState().read(place)
  }, [place, query?.trigger])

  const matches = useMemo<MentionItem[]>(() => {
    if (query?.trigger === '@')
      return [
        ...(includeMembers
          ? memberMentionCandidates(members, query.text).map(member => ({ kind: 'member' as const, member }))
          : []),
        ...mentionCandidates(agents, query.text).map(agent => ({ kind: 'agent' as const, agent }))
      ]
    if (query?.trigger === '#')
      return refCandidates(crewRefs(docs, boards), query.text).map(ref => ({ kind: 'ref', ref }))
    if (query?.trigger === '/')
      return pathCandidates(files, query.text, PATH_MATCHES).map(match => ({ kind: 'path', match }))
    if (query?.trigger === ':') {
      // The menu is as long as it ever was, so the crew's own take the places at
      // the head of it rather than adding rows underneath the sheet's.
      const crew = searchCustomEmoji(query.text, EMOJI_MATCHES).map(emoji => ({
        kind: 'custom' as const,
        emoji
      }))
      return [
        ...crew,
        ...searchEmoji(query.text, EMOJI_MATCHES - crew.length).map(entry => ({
          kind: 'emoji' as const,
          entry
        }))
      ]
    }
    return []
  }, [agents, boards, docs, includeMembers, members, query])
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0))

  const onChange = (next: string) => {
    const caret = inputRef.current?.selectionStart ?? next.length
    const head = next.slice(0, caret)
    const closed = EMOJI_CLOSED.exec(head)
    // A name the crew made up is left standing rather than turned into a
    // character, whether or not the sheet answers to it too: the picture is what
    // somebody typing their own name meant, and the sheet already has a menu.
    const char = closed && !lookupCustomEmoji(closed[1]) && emojiForShortcode(closed[1])
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
    // One of the crew's own goes in as the name it is written with, since that is
    // what draws the picture wherever the message ends up.
    const emoji = item.kind === 'emoji' || item.kind === 'custom'
    const token =
      item.kind === 'agent'
        ? `@${item.agent.label}`
        : item.kind === 'member'
          ? `@${item.member.name}`
          : item.kind === 'ref'
            ? `#${item.ref.title}`
            : item.kind === 'custom'
              ? customEmojiRef(item.emoji.name)
              : item.entry.char
    if (emoji) rememberEmoji(token)
    const before = value.slice(0, caret).replace(emoji ? EMOJI_TAIL : /[@#][^@#]*$/, token)
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

function MemberRow({
  member,
  active,
  onClick,
  onMouseEnter
}: {
  member: MemberInfo
  active: boolean
  onClick: () => void
  onMouseEnter: () => void
}) {
  const selfId = useCrew(s => s.selfId)
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
        active ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:bg-fg/[0.08] hover:text-fg'
      }`}
    >
      <Avatar name={member.name} size="sm" presence={member.connected ? 'online' : 'offline'} />
      <span className="flex-1 truncate">@{member.name}</span>
      <span className="text-xs text-fg-muted shrink-0">{member.id === selfId ? 'You' : 'Person'}</span>
    </button>
  )
}

function RefRow({
  refItem,
  active,
  onClick,
  onMouseEnter
}: {
  refItem: CrewRef
  active: boolean
  onClick: () => void
  onMouseEnter: () => void
}) {
  const Icon = refItem.kind === 'board' ? FrameGlyph : DocGlyph
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
        active ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:bg-fg/[0.08] hover:text-fg'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0 text-sky-300 light:text-sky-700" />
      <span className="flex-1 truncate">#{refItem.title}</span>
      <span className="text-xs text-fg-muted shrink-0">{refItem.kind === 'board' ? 'Board' : 'Doc'}</span>
    </button>
  )
}

// One row for both, since a character and a `:name:` are the same two things to
// draw: the picture, and the name somebody would type to reach it.
function EmojiRow({
  char,
  name,
  active,
  onClick,
  onMouseEnter
}: {
  char: string
  name: string
  active: boolean
  onClick: () => void
  onMouseEnter: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      aria-label={`:${name}:`}
      className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
        active ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:bg-fg/[0.08] hover:text-fg'
      }`}
    >
      <Emoji char={char} size={18} />
      <span className="flex-1 truncate">:{name}:</span>
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
      {matches.map((item, index) => {
        if (item.kind === 'agent')
          return (
            <AgentRow
              key={item.agent.id}
              agent={item.agent}
              active={index === activeIndex}
              onClick={() => onPick(item)}
              onMouseEnter={() => onHover(index)}
            />
          )
        if (item.kind === 'member')
          return (
            <MemberRow
              key={item.member.id}
              member={item.member}
              active={index === activeIndex}
              onClick={() => onPick(item)}
              onMouseEnter={() => onHover(index)}
            />
          )
        if (item.kind === 'ref')
          return (
            <RefRow
              key={`${item.ref.kind}:${item.ref.key}`}
              refItem={item.ref}
              active={index === activeIndex}
              onClick={() => onPick(item)}
              onMouseEnter={() => onHover(index)}
            />
          )
        if (item.kind === 'custom')
          return (
            <EmojiRow
              key={item.emoji.id}
              char={customEmojiRef(item.emoji.name)}
              name={item.emoji.name}
              active={index === activeIndex}
              onClick={() => onPick(item)}
              onMouseEnter={() => onHover(index)}
            />
          )
        return (
          <EmojiRow
            key={item.entry.char}
            char={item.entry.char}
            name={item.entry.shortName}
            active={index === activeIndex}
            onClick={() => onPick(item)}
            onMouseEnter={() => onHover(index)}
          />
        )
      })}
    </div>
  )
}
