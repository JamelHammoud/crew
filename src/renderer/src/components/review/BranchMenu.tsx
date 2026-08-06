import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cleanBranchName, BRANCH_NAME_LIMIT } from '../../../../shared/branch'
import type { RepoBranch } from '../../../../shared/repository'
import { BranchGlyph, CheckGlyph, ChevronDownGlyph, ChevronLeftGlyph, CloudGlyph, PlusGlyph, SearchGlyph } from '../../icons'
import { Popover } from '../Popover'
import ScreenSwap from '../ScreenSwap'
import { bringInto } from '../scrollInto'
import Spinner from '../Spinner'
import TextField from '../TextField'

const ROW =
  'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left whitespace-nowrap text-fg/70 transition-colors hover:text-fg hover:bg-fg/5 data-active:text-fg data-active:bg-fg/5'

export default function BranchMenu({
  branch,
  branches,
  busy,
  onSwitch,
  onCreate
}: {
  branch: string
  branches: RepoBranch[]
  busy: boolean
  onSwitch: (name: string) => void
  onCreate: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<'branches' | 'new'>('branches')
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [at, setAt] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const shown = useMemo(() => {
    const all = branches ?? []
    const asked = query.trim().toLowerCase()
    if (!asked) return all
    return all.filter(one => one.name.toLowerCase().includes(asked))
  }, [branches, query])

  const wanted = cleanBranchName(query)
  const fresh = wanted.length > 0 && !(branches ?? []).some(one => one.name === wanted)
  const active = shown[at] ?? null

  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-row="${at}"]`)
    if (row) bringInto(row, listRef.current)
  }, [at])

  const shut = () => {
    setOpen(false)
    setScreen('branches')
    setQuery('')
    setName('')
    setAt(0)
  }

  const go = (one: RepoBranch) => {
    shut()
    if (!one.current) onSwitch(one.name)
  }

  const make = (text: string) => {
    const clean = cleanBranchName(text)
    if (!clean) return
    shut()
    onCreate(clean)
  }

  const toNew = () => {
    setName(query)
    setScreen('new')
  }

  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const by = event.key === 'ArrowDown' ? 1 : -1
      setAt(now => Math.min(Math.max(now + by, 0), Math.max(shown.length - 1, 0)))
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (active) go(active)
    else if (fresh) make(query)
  }

  return (
    <div className="relative flex min-w-0 items-center">
      <button
        onClick={() => setOpen(true)}
        className="flex h-7 min-w-0 items-center gap-1.5 rounded-full pl-1.5 pr-2 text-fg-secondary transition-colors hover:bg-fg/10 hover:text-fg active:scale-[0.97]"
      >
        {busy ? (
          <Spinner size={13} />
        ) : (
          <BranchGlyph className="h-4 w-4 shrink-0 text-fg-faint" />
        )}
        <span className="min-w-0 truncate text-[13px]">{branch || 'Project'}</span>
        <ChevronDownGlyph className="h-3 w-3 shrink-0 text-fg-faint" />
      </button>

      <Popover open={open} onClose={shut} align="start" flush className="overflow-hidden">
        <div className="w-72">
          <ScreenSwap screen={screen} depth={screen === 'branches' ? 0 : 1}>
            {screen === 'branches' ? (
              <div>
                <div className="flex h-12 items-center gap-2.5 border-b border-fg/[0.06] px-4">
                  <SearchGlyph className="h-4 w-4 shrink-0 text-fg/40" />
                  <input
                    autoFocus
                    value={query}
                    onChange={event => {
                      setQuery(event.target.value)
                      setAt(0)
                    }}
                    onKeyDown={keys}
                    placeholder="Find a branch"
                    aria-label="Find a branch"
                    spellCheck={false}
                    className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg/35"
                  />
                </div>
                <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
                  {shown.map((one, index) => (
                    <button
                      key={one.name}
                      data-row={index}
                      onClick={() => go(one)}
                      onPointerEnter={() => setAt(index)}
                      data-active={index === at ? '' : undefined}
                      className={ROW}
                    >
                      <span className="min-w-0 flex-1 truncate">{one.name}</span>
                      {one.remote && !one.current && <CloudGlyph className="h-4 w-4 shrink-0 text-fg/35" />}
                      {one.current && <CheckGlyph className="h-4 w-4 shrink-0 text-fg" />}
                    </button>
                  ))}
                  <button onClick={() => (fresh ? make(query) : toNew())} className={ROW}>
                    <PlusGlyph className="h-4 w-4 shrink-0 text-fg/40" />
                    <span className="min-w-0 flex-1 truncate">{fresh ? `New branch ${wanted}` : 'New branch'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-1.5">
                <div className="flex items-center gap-1.5 px-1 pb-2 pt-0.5">
                  <button
                    onClick={() => setScreen('branches')}
                    aria-label="Back"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg/70 transition-colors hover:bg-fg/10 hover:text-fg"
                  >
                    <ChevronLeftGlyph className="h-4 w-4" />
                  </button>
                  <span className="min-w-0 flex-1 text-sm font-medium text-fg">New branch</span>
                </div>
                <div className="px-2 pb-1.5">
                  <TextField
                    glass
                    autoFocus
                    value={name}
                    maxLength={BRANCH_NAME_LIMIT}
                    onChange={event => setName(event.target.value)}
                    onKeyDown={event => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      make(name)
                    }}
                    placeholder="Name"
                    spellCheck={false}
                  />
                  <button
                    onClick={() => make(name)}
                    disabled={cleanBranchName(name).length === 0}
                    className="mt-2 h-9 w-full rounded-full bg-fg text-sm font-semibold text-ink-900 transition-all duration-150 hover:bg-fg/90 active:scale-[0.98] disabled:bg-fg/10 disabled:text-fg/45"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
          </ScreenSwap>
        </div>
      </Popover>
    </div>
  )
}
