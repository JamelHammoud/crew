import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { slashCandidates, type CommandName, type SlashCommand } from '../../../shared/commands'
import { COMMAND_MARKS } from './CommandChip'
import { bringInto } from './scrollInto'

export type SlashMatch = { kind: 'command'; command: SlashCommand }

export function useSlashCommands(
  value: string,
  setValue: (text: string) => void,
  onCommand: (name: CommandName) => void,
  inputRef: RefObject<HTMLTextAreaElement>,
  offered: readonly SlashCommand[]
) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const matches = useMemo<SlashMatch[]>(() => {
    if (value === dismissed) return []
    return slashCandidates(value, offered).map(command => ({ kind: 'command', command }))
  }, [dismissed, offered, value])
  const open = value !== dismissed && matches.length > 0
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0))

  useEffect(() => setActive(0), [value])

  const pick = (match: SlashMatch) => {
    onCommand(match.command.name)
    setValue('')
    setDismissed(null)
    setActive(0)
    inputRef.current?.focus()
  }

  const close = () => setDismissed(value)

  const onKeyDown = (e: React.KeyboardEvent): boolean => {
    if (!open) return false
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && matches.length > 0) {
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
      const match = matches[activeIndex]
      if (match) pick(match)
      return true
    }
    return false
  }

  return { matches, activeIndex, setActive, pick, close, onKeyDown }
}

export function SlashMenu({
  matches,
  activeIndex,
  onPick,
  onHover
}: {
  matches: SlashMatch[]
  activeIndex: number
  onPick: (match: SlashMatch) => void
  onHover: (index: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const row = listRef.current?.children[activeIndex]
    if (row instanceof HTMLElement) bringInto(row, listRef.current)
  }, [activeIndex])

  if (matches.length === 0) return null
  return (
    <div
      ref={listRef}
      className="glass absolute bottom-full mb-2 left-0 rounded-2xl p-1.5 min-w-64 max-h-56 overflow-y-auto animate-pop z-[70]"
    >
      {matches.map((match, index) => {
        const active = index === activeIndex
        const Icon = COMMAND_MARKS[match.command.name]
        return (
          <button
            key={`command:${match.command.name}`}
            onClick={() => onPick(match)}
            onMouseEnter={() => onHover(index)}
            className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
              active ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:bg-fg/[0.08] hover:text-fg'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0 text-fg-muted" />
            <span className="shrink-0">/{match.command.name}</span>
            <span className="text-xs text-fg-muted truncate">{match.command.hint}</span>
          </button>
        )
      })}
    </div>
  )
}
