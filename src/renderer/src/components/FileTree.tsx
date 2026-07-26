import { useEffect, useMemo, useState } from 'react'
import { markRuns, matchFiles, type FileEntry, type FileMatch } from '../../../shared/files'
import { ChevronRightGlyph, FileGlyph, SearchGlyph } from '../icons'
import { useBrowser, type BrowserTab } from '../state/browser'
import Skeleton from './Skeleton'

const MATCH_LIMIT = 60

const row = 'w-full h-7 pr-2 flex items-center gap-1.5 text-[13px] text-left transition-colors'
const quiet = 'text-fg-secondary hover:bg-fg/[0.04] hover:text-fg'
const picked = 'bg-fg/[0.06] text-fg'

const indent = (depth: number): string => `${8 + depth * 14}px`

function Marked({ text, hits }: { text: string; hits: number[] }) {
  return (
    <>
      {markRuns(text, hits).map((run, index) => (
        <span key={index} className={run.hit ? 'text-fg' : undefined}>
          {run.text}
        </span>
      ))}
    </>
  )
}

function Loading({ depth }: { depth: number }) {
  return (
    <div className="py-1 space-y-1.5" style={{ paddingLeft: indent(depth), paddingRight: 16 }}>
      {[70, 52, 61].map(width => (
        <Skeleton key={width} className="h-3 rounded-full" />
      ))}
    </div>
  )
}

function useEntries(path: string, generation: number): FileEntry[] | null {
  const [entries, setEntries] = useState<FileEntry[] | null>(null)

  useEffect(() => {
    let alive = true
    window.crew
      .readFile(path)
      .then(result => {
        if (alive) setEntries(result?.kind === 'dir' ? result.entries : [])
      })
      .catch(() => {
        if (alive) setEntries([])
      })
    return () => {
      alive = false
    }
  }, [path, generation])

  return entries
}

function Folder({ tab, path, name, depth }: { tab: BrowserTab; path: string; name: string; depth: number }) {
  const open = tab.open.includes(path)
  return (
    <>
      <button
        onClick={() => useBrowser.getState().toggleFolder(tab.id, path)}
        data-folder={path}
        aria-expanded={open}
        style={{ paddingLeft: indent(depth) }}
        className={`${row} ${quiet}`}
      >
        <ChevronRightGlyph
          className={`w-3.5 h-3.5 shrink-0 text-fg-muted transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
        <span className="truncate">{name}</span>
      </button>
      {open && <Branch tab={tab} path={path} depth={depth + 1} />}
    </>
  )
}

function Leaf({ tab, path, name, depth }: { tab: BrowserTab; path: string; name: string; depth: number }) {
  const ref = useRef<HTMLButtonElement>(null)
  const showing = tab.path === path

  useEffect(() => {
    if (showing) ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [showing])

  return (
    <button
      ref={ref}
      onClick={() => useBrowser.getState().navigateFile(tab.id, path)}
      data-file={path}
      style={{ paddingLeft: indent(depth) }}
      className={`${row} ${showing ? picked : quiet}`}
    >
      <FileGlyph className="w-3.5 h-3.5 shrink-0 text-fg-faint" />
      <span className="truncate">{name}</span>
    </button>
  )
}

function Branch({ tab, path, depth }: { tab: BrowserTab; path: string; depth: number }) {
  const entries = useEntries(path, tab.generation)

  if (!entries) return <Loading depth={depth} />
  if (entries.length === 0 && depth === 0) {
    return <p className="px-3 py-6 text-[13px] text-fg-faint text-center">Open a project to see its files</p>
  }
  return (
    <>
      {entries.map(entry => {
        const child = path ? `${path}/${entry.name}` : entry.name
        return entry.dir ? (
          <Folder key={child} tab={tab} path={child} name={entry.name} depth={depth} />
        ) : (
          <Leaf key={child} tab={tab} path={child} name={entry.name} depth={depth} />
        )
      })}
    </>
  )
}

function Match({ tab, match }: { tab: BrowserTab; match: FileMatch }) {
  const start = match.path.lastIndexOf('/') + 1
  const name = match.path.slice(start)
  const folder = start ? match.path.slice(0, start - 1) : ''
  return (
    <button
      onClick={() => useBrowser.getState().navigateFile(tab.id, match.path)}
      data-file={match.path}
      style={{ paddingLeft: indent(0) }}
      className={`${row} ${tab.path === match.path ? picked : quiet}`}
    >
      <FileGlyph className="w-3.5 h-3.5 shrink-0 text-fg-faint" />
      <span className="shrink-0 max-w-[70%] truncate">
        <Marked text={name} hits={match.hits.filter(hit => hit >= start).map(hit => hit - start)} />
      </span>
      {folder && (
        <span className="min-w-0 truncate text-xs text-fg-faint">
          <Marked text={folder} hits={match.hits.filter(hit => hit < start)} />
        </span>
      )}
    </button>
  )
}

function Matches({ tab, query }: { tab: BrowserTab; query: string }) {
  const [paths, setPaths] = useState<string[] | null>(null)

  useEffect(() => {
    let alive = true
    window.crew
      .listFiles()
      .then(found => {
        if (alive) setPaths(found)
      })
      .catch(() => {
        if (alive) setPaths([])
      })
    return () => {
      alive = false
    }
  }, [tab.generation])

  const found = useMemo(() => (paths ? matchFiles(paths, query, MATCH_LIMIT) : []), [paths, query])

  if (!paths) return <Loading depth={0} />
  if (found.length === 0) {
    return <p className="px-3 py-6 text-[13px] text-fg-faint text-center">Nothing here by that name</p>
  }
  return (
    <>
      {found.map(match => (
        <Match key={match.path} tab={tab} match={match} />
      ))}
    </>
  )
}

export default function FileTree({ tab }: { tab: BrowserTab }) {
  const [query, setQuery] = useState('')

  return (
    <aside className="w-[42%] min-w-[168px] max-w-[288px] shrink-0 flex flex-col border-l border-ink-700">
      <div className="p-2 shrink-0">
        <div className="relative flex">
          <SearchGlyph className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint pointer-events-none" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Filter files"
            aria-label="Filter files"
            spellCheck={false}
            className="w-full h-9 pl-9 pr-3 rounded-full bg-fg/[0.06] text-sm text-fg placeholder:text-fg-faint outline-none transition-colors focus:bg-fg/[0.08]"
          />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto pb-2">
        {query.trim() ? <Matches tab={tab} query={query} /> : <Branch tab={tab} path="" depth={0} />}
      </div>
    </aside>
  )
}
