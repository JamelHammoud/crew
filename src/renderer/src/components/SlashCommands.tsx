import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { slashCandidates, type CommandName, type SlashCommand } from '../../../shared/commands'
import { resolvePlugin, type CrewPlugin } from '../../../shared/plugins'
import { PlugGlyph } from '../icons'
import { COMMAND_MARKS } from './CommandChip'
import PluginMark from './plugins/PluginMark'
import { bringInto } from './scrollInto'
import { locallyConnected, usePluginConnections } from '../state/pluginConnections'

export type SlashMatch =
  | { kind: 'command'; command: SlashCommand }
  | { kind: 'plugins' }
  | { kind: 'plugin'; plugin: CrewPlugin }

const directQuery = (value: string): string | null => /^\/(\S*)$/.exec(value)?.[1].toLowerCase() ?? null

const pluginQuery = (value: string): string | null => {
  const match = /^\/plugin\s(.*)$/i.exec(value)
  return match ? match[1].trim().toLowerCase() : null
}

const pluginMatches = (plugins: readonly CrewPlugin[], query: string): CrewPlugin[] =>
  plugins.filter(plugin => {
    const resolved = resolvePlugin(plugin)
    return [resolved.name, resolved.label, resolved.blurb].some(word => word.toLowerCase().includes(query))
  })

export function useSlashCommands(
  value: string,
  setValue: (text: string) => void,
  onCommand: (name: CommandName) => void,
  inputRef: RefObject<HTMLTextAreaElement>,
  offered: readonly SlashCommand[],
  plugins: readonly CrewPlugin[],
  onPlugin: (plugin: CrewPlugin) => void
) {
  const connectionIds = usePluginConnections(s => s.ids)
  const availablePlugins = useMemo(
    () => plugins.filter(plugin => locallyConnected(plugin, connectionIds)),
    [connectionIds, plugins]
  )
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const nested = pluginQuery(value)
  const matches = useMemo<SlashMatch[]>(() => {
    if (value === dismissed) return []
    if (nested !== null) return pluginMatches(availablePlugins, nested).map(plugin => ({ kind: 'plugin', plugin }))
    const found: SlashMatch[] = slashCandidates(value, offered).map(command => ({ kind: 'command', command }))
    const direct = directQuery(value)
    if (direct === null) return found
    if ('plugin'.startsWith(direct)) found.push({ kind: 'plugins' })
    if (direct) {
      for (const plugin of availablePlugins) {
        if (plugin.name.startsWith(direct) && plugin.name !== 'plugin') {
          found.push({ kind: 'plugin', plugin })
        }
      }
    }
    return found
  }, [availablePlugins, dismissed, nested, offered, value])
  const open = value !== dismissed && (matches.length > 0 || nested !== null)
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0))

  useEffect(() => setActive(0), [value])

  const pick = (match: SlashMatch) => {
    if (match.kind === 'plugins') {
      setValue('/plugin ')
      setDismissed(null)
      setActive(0)
      inputRef.current?.focus()
      return
    }
    if (match.kind === 'plugin') {
      onPlugin(match.plugin)
    } else {
      onCommand(match.command.name)
    }
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

  const empty = nested === null || matches.length > 0 ? null : nested ? 'No plugins found' : 'No plugins installed'
  return { matches, activeIndex, setActive, pick, close, onKeyDown, empty }
}

export function SlashMenu({
  matches,
  activeIndex,
  onPick,
  onHover,
  empty
}: {
  matches: SlashMatch[]
  activeIndex: number
  onPick: (match: SlashMatch) => void
  onHover: (index: number) => void
  empty?: string | null
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const row = listRef.current?.children[activeIndex]
    if (row instanceof HTMLElement) bringInto(row, listRef.current)
  }, [activeIndex])

  if (matches.length === 0 && !empty) return null
  return (
    <div
      ref={listRef}
      className="glass absolute bottom-full mb-2 left-0 rounded-2xl p-1.5 min-w-64 max-h-56 overflow-y-auto animate-pop z-[70]"
    >
      {empty && <p className="px-3 py-2.5 text-sm text-fg/45">{empty}</p>}
      {matches.map((match, index) => {
        const active = index === activeIndex
        if (match.kind === 'command') {
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
        }
        if (match.kind === 'plugins') {
          return (
            <button
              key="plugins"
              onClick={() => onPick(match)}
              onMouseEnter={() => onHover(index)}
              className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
                active ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:bg-fg/[0.08] hover:text-fg'
              }`}
            >
              <PlugGlyph className="w-4 h-4 shrink-0 text-fg-muted" />
              <span className="shrink-0">/plugin</span>
              <span className="text-xs text-fg-muted truncate">Open an installed plugin</span>
            </button>
          )
        }
        const plugin = resolvePlugin(match.plugin)
        return (
          <button
            key={`plugin:${match.plugin.id}`}
            onClick={() => onPick(match)}
            onMouseEnter={() => onHover(index)}
            className={`w-full text-left px-2.5 py-2 rounded-xl text-sm flex items-center gap-2.5 transition-colors ${
              active ? 'bg-fg/[0.08] text-fg' : 'text-fg-secondary hover:bg-fg/[0.08] hover:text-fg'
            }`}
          >
            <PluginMark seed={plugin.name} box={16} />
            <span className="shrink-0">/{plugin.name}</span>
            <span className="text-xs text-fg-muted truncate">{plugin.label}</span>
          </button>
        )
      })}
    </div>
  )
}
