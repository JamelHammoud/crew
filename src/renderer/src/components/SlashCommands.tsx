import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { slashCandidates, type CommandName, type SlashCommand } from '../../../shared/commands'
import { COMMAND_MARKS } from './CommandChip'

export function useSlashCommands(
  value: string,
  setValue: (text: string) => void,
  onCommand: (name: CommandName) => void,
  inputRef: RefObject<HTMLTextAreaElement>
) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const matches = useMemo(() => (value === dismissed ? [] : slashCandidates(value)), [dismissed, value])
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0))

  const pick = (command: SlashCommand) => {
    onCommand(command.name)
    setValue('')
    setDismissed(null)
    setActive(0)
    inputRef.current?.focus()
  }

  const close = () => setDismissed(value)

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

  return { matches, activeIndex, setActive, pick, close, onKeyDown }
}

export function SlashMenu({
  matches,
  activeIndex,
  onPick,
  onHover
}: {
  matches: SlashCommand[]
  activeIndex: number
  onPick: (command: SlashCommand) => void
  onHover: (index: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (matches.length === 0) return null
  return (
    <div
      ref={listRef}
      className="glass absolute bottom-full mb-2 left-0 rounded-2xl p-1.5 min-w-64 max-h-56 overflow-y-auto animate-pop z-50"
    >
      {matches.map((command, index) => {
        const Icon = COMMAND_MARKS[command.name]
        return (
          <button
            key={command.name}
            onClick={() => onPick(command)}
            onMouseEnter={() => onHover(index)}
            className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
              index === activeIndex ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:bg-fg/[0.08] hover:text-fg'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0 text-fg-muted" />
            <span className="shrink-0">/{command.name}</span>
            <span className="text-xs text-fg-muted truncate">{command.hint}</span>
          </button>
        )
      })}
    </div>
  )
}
