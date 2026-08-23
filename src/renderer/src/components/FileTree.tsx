import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { matchFiles, type FileContentMatch, type FileEntry, type FileMatch } from '../../../shared/files'
import { ChevronRightGlyph, FileGlyph, FolderGlyph } from '../icons'
import { useBrowser, type BrowserTab } from '../state/browser'
import { useFileMenu } from './fileMenu'
import Marked from './Marked'
import SearchField from './SearchField'
import { bringInto } from './scrollInto'
import Skeleton from './Skeleton'

const MATCH_LIMIT = 60

const row = 'w-full h-7 pr-2 flex items-center gap-1.5 text-[13px] text-left transition-colors'
const quiet = 'text-fg-secondary hover:bg-fg/[0.04] hover:text-fg'
const picked = 'bg-fg/[0.06] text-fg'

const indent = (depth: number): string => `${8 + depth * 14}px`

function openFile(tab: BrowserTab, path: string, event: MouseEvent, line: number | null = null): void {
  if (event.shiftKey) useBrowser.getState().addFileTab(path, line)
  else useBrowser.getState().navigateFile(tab.id, path, line)
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
  const { onContextMenu, menu } = useFileMenu(path)

  useEffect(() => {
    if (showing && ref.current) bringInto(ref.current)
  }, [showing])

  return (
    <>
      <button
        ref={ref}
        onClick={event => openFile(tab, path, event)}
        onContextMenu={onContextMenu}
        data-file={path}
        style={{ paddingLeft: indent(depth) }}
        className={`${row} ${showing ? picked : quiet}`}
      >
        <FileGlyph className="w-3.5 h-3.5 shrink-0 text-fg-faint" />
        <span className="truncate">{name}</span>
      </button>
      {menu}
    </>
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

function Match({ tab, match, dir }: { tab: BrowserTab; match: FileMatch; dir: boolean }) {
  const start = match.path.lastIndexOf('/') + 1
  const name = match.path.slice(start)
  const folder = start ? match.path.slice(0, start - 1) : ''
  const { onContextMenu, menu } = useFileMenu(match.path)
  return (
    <>
      <button
        onClick={event => {
          if (dir) useBrowser.getState().navigateFile(tab.id, match.path)
          else openFile(tab, match.path, event)
        }}
        onContextMenu={onContextMenu}
        data-file={dir ? undefined : match.path}
        data-folder={dir ? match.path : undefined}
        style={{ paddingLeft: indent(0) }}
        className={`${row} ${tab.path === match.path ? picked : quiet}`}
      >
        {dir ? (
          <FolderGlyph className="w-3.5 h-3.5 shrink-0 text-fg-muted" />
        ) : (
          <FileGlyph className="w-3.5 h-3.5 shrink-0 text-fg-faint" />
        )}
        <span className="shrink-0 max-w-[70%] truncate">
          <Marked text={name} hits={match.hits.filter(hit => hit >= start).map(hit => hit - start)} />
        </span>
        {folder && (
          <span className="min-w-0 truncate text-xs text-fg-faint">
            <Marked text={folder} hits={match.hits.filter(hit => hit < start)} />
          </span>
        )}
      </button>
      {menu}
    </>
  )
}

function ContentMatch({ tab, match }: { tab: BrowserTab; match: FileContentMatch }) {
  const { onContextMenu, menu } = useFileMenu(match.path)
  return (
    <>
      <button
        onClick={event => openFile(tab, match.path, event, match.line)}
        onContextMenu={onContextMenu}
        data-content-file={match.path}
        data-content-line={match.line}
        className={`w-full px-3 py-1.5 text-left transition-colors ${
          tab.path === match.path && tab.line === match.line ? picked : quiet
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-xs">
          <FileGlyph className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
          <span className="min-w-0 truncate text-fg-secondary">{match.path}</span>
          <span className="shrink-0 text-fg-faint">:{match.line}</span>
        </span>
        <span className="mt-0.5 block truncate pl-5 font-mono text-xs text-fg-muted">
          {match.text.slice(0, match.start)}
          <span className="text-fg">{match.text.slice(match.start, match.end)}</span>
          {match.text.slice(match.end)}
        </span>
      </button>
      {menu}
    </>
  )
}

function useProjectFiles(generation: number): string[] | null {
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
  }, [generation])

  return paths
}

function useContentMatches(query: string, generation: number) {
  const [matches, setMatches] = useState<FileContentMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [limited, setLimited] = useState(false)

  useEffect(() => {
    const value = query.trim()
    if (!value) {
      setMatches([])
      setLoading(false)
      setFailed(false)
      setLimited(false)
      return
    }
    let alive = true
    setMatches([])
    setLoading(true)
    setFailed(false)
    setLimited(false)
    const timer = window.setTimeout(() => {
      window.crew
        .searchFiles(value)
        .then(result => {
          if (!alive) return
          setMatches(result.matches)
          setLimited(result.limited)
          setLoading(false)
        })
        .catch(() => {
          if (!alive) return
          setMatches([])
          setLimited(false)
          setLoading(false)
          setFailed(true)
        })
    }, 160)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [query, generation])

  return { matches, loading, failed, limited }
}

function Heading({ children }: { children: string }) {
  return <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-fg-faint">{children}</p>
}

function Matches({
  tab,
  paths,
  names,
  folders,
  contents,
  loading,
  failed,
  limited
}: {
  tab: BrowserTab
  paths: string[] | null
  names: FileMatch[]
  folders: Set<string>
  contents: FileContentMatch[]
  loading: boolean
  failed: boolean
  limited: boolean
}) {
  if (!paths) return <Loading depth={0} />
  if (failed) return <p className="px-3 py-6 text-center text-[13px] text-danger">Could not search files</p>
  if (!loading && names.length === 0 && contents.length === 0) {
    return <p className="px-3 py-6 text-center text-[13px] text-fg-faint">Nothing found</p>
  }

  return (
    <>
      {names.length > 0 && <Heading>Files and folders</Heading>}
      {names.map(match => <Match key={match.path} tab={tab} match={match} dir={folders.has(match.path)} />)}
      {contents.length > 0 && <Heading>Contents</Heading>}
      {contents.map(match => <ContentMatch key={`${match.path}:${match.line}`} tab={tab} match={match} />)}
      {loading && <Loading depth={0} />}
      {!loading && limited && <p className="px-3 py-2 text-xs text-fg-faint">Some matches are not shown</p>}
    </>
  )
}

export default function FileTree({ tab }: { tab: BrowserTab }) {
  const [query, setQuery] = useState('')
  const paths = useProjectFiles(tab.generation)
  const folders = useMemo(() => {
    const found = new Set<string>()
    for (const path of paths ?? []) {
      const parts = path.split('/').slice(0, -1)
      for (let at = 1; at <= parts.length; at++) found.add(parts.slice(0, at).join('/'))
    }
    return found
  }, [paths])
  const names = useMemo(
    () => (paths ? matchFiles([...folders, ...paths], query, MATCH_LIMIT) : []),
    [paths, folders, query]
  )
  const content = useContentMatches(query, tab.generation)

  const onKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && query) {
      event.preventDefault()
      setQuery('')
      return
    }
    if (event.key !== 'Enter') return
    const firstName = names[0]
    const firstContent = content.matches[0]
    if (!firstName && !firstContent) return
    event.preventDefault()
    if (firstName) useBrowser.getState().navigateFile(tab.id, firstName.path)
    else if (firstContent) useBrowser.getState().navigateFile(tab.id, firstContent.path, firstContent.line)
  }

  return (
    <aside className="w-[42%] min-w-[168px] max-w-[288px] shrink-0 flex flex-col border-l border-ink-700">
      <SearchField value={query} onChange={setQuery} onKeyDown={onKeys} placeholder="Search files" />
      <div className="flex-1 min-h-0 overflow-auto pb-2">
        {query.trim() ? (
          <Matches
            tab={tab}
            paths={paths}
            names={names}
            folders={folders}
            contents={content.matches}
            loading={content.loading}
            failed={content.failed}
            limited={content.limited}
          />
        ) : (
          <Branch tab={tab} path="" depth={0} />
        )}
      </div>
    </aside>
  )
}
