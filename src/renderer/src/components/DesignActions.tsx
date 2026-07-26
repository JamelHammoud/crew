import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, type TLShape } from 'tldraw'
import { actionRows, searchActions, type ActionRow } from '../design/actionSearch'
import type { CommandContext } from '../design/commands'
import { SearchGlyph, SparkGlyph } from '../design/glyphs'
import { Popover } from './Popover'
import Tooltip from './Tooltip'

export default function DesignActions({
  onAsk,
  onRename
}: {
  onAsk: () => void
  onRename: (shape: TLShape) => void
}) {
  const editor = useEditor()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      setOpen(value => !value)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const ctx: CommandContext = useMemo(
    () => ({ editor, point: null, ask: onAsk, rename: onRename }),
    [editor, onAsk, onRename]
  )

  return (
    <span className="relative flex items-center">
      <Tooltip label="Actions  ⌘K" disabled={open}>
        <button
          onClick={() => setOpen(value => !value)}
          aria-label="Actions"
          aria-expanded={open}
          className={`h-9 pl-2.5 pr-3.5 rounded-full flex items-center gap-1.5 text-sm font-semibold transition-all active:scale-95 ${
            open ? 'bg-fg text-ink-900' : 'text-fg/70 hover:text-fg hover:bg-fg/[0.06]'
          }`}
        >
          <SparkGlyph className="w-[18px] h-[18px]" />
          Actions
        </button>
      </Tooltip>
      {open && <ActionsPalette ctx={ctx} onClose={() => setOpen(false)} />}
    </span>
  )
}

function ActionsPalette({ ctx, onClose }: { ctx: CommandContext; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => actionRows(ctx), [ctx])
  const groups = useMemo(() => searchActions(rows, query), [rows, query])
  const flat = useMemo(() => groups.flatMap(group => group.rows), [groups])
  const active = flat[Math.min(at, flat.length - 1)]

  useEffect(() => setAt(0), [query])

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  useEffect(() => {
    listRef.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' })
  }, [at, query])

  const pick = (row: ActionRow) => {
    row.run()
    onClose()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setAt(value => Math.min(value + 1, flat.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setAt(value => Math.max(value - 1, 0))
      return
    }
    if (event.key === 'Enter' && active) {
      event.preventDefault()
      pick(active)
    }
  }

  return (
    <Popover open onClose={onClose} side="top" align="start" className="p-0 overflow-hidden">
      <div className="w-80">
        <div className="flex items-center gap-2.5 px-3.5 h-11 border-b border-fg/[0.06]">
          <SearchGlyph className="w-4 h-4 shrink-0 text-fg/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Find an action"
            aria-label="Find an action"
            className="flex-1 min-w-0 bg-transparent text-sm text-fg placeholder:text-fg/35 outline-none"
          />
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {flat.length === 0 && <p className="px-3 py-6 text-center text-sm text-fg/40">Nothing matches that.</p>}
          {groups.map(group => (
            <div key={group.section}>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-fg/35">{group.section}</p>
              {group.rows.map(row => (
                <button
                  key={row.id}
                  onClick={() => pick(row)}
                  onPointerEnter={() => setAt(flat.indexOf(row))}
                  data-active={row === active ? '' : undefined}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left whitespace-nowrap text-fg/70 transition-colors data-active:text-fg data-active:bg-fg/5"
                >
                  <row.Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">{row.label}</span>
                  {row.hint && <span className="text-xs text-fg/40 tabular-nums">{row.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Popover>
  )
}
