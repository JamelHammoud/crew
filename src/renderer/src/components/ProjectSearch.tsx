import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { matchFiles, type FileContentMatch, type FileMatch } from '../../../shared/files'
import { compileFileFilter, compileFileSearch, type FileReplaceTarget } from '../../../shared/fileSearch'
import { ChevronRightGlyph, FileGlyph, FolderGlyph, PencilGlyph } from '../icons'
import { useBrowser, type BrowserTab } from '../state/browser'
import { toast } from '../state/toast'
import FileSearchControls, { type FileSearchForm } from './FileSearchControls'
import { useFileMenu } from './fileMenu'
import Marked from './Marked'
import Skeleton from './Skeleton'
import Tooltip from './Tooltip'

const MATCH_LIMIT = 60
const row = 'w-full h-7 pr-2 flex items-center gap-1.5 text-[13px] text-left transition-colors'
const quiet = 'text-fg-secondary hover:bg-fg/[0.04] hover:text-fg'
const picked = 'bg-fg/[0.06] text-fg'
const initial: FileSearchForm = {
  query: '',
  replacement: '',
  matchCase: false,
  wholeWord: false,
  regex: false,
  preserveCase: false,
  include: '',
  exclude: ''
}

function openFile(tab: BrowserTab, path: string, event: MouseEvent, line: number | null = null): void {
  if (event.shiftKey) useBrowser.getState().addFileTab(path, line)
  else useBrowser.getState().navigateFile(tab.id, path, line)
}

function Loading() {
  return (
    <div className="space-y-1.5 px-4 py-3">
      {[70, 52, 61].map(width => (
        <Skeleton key={width} className="h-3 rounded-full" />
      ))}
    </div>
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

function useContentMatches(form: FileSearchForm, generation: number, revision: number, cleared: boolean) {
  const [matches, setMatches] = useState<FileContentMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [limited, setLimited] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const query = form.query.trim()
    if (!query || cleared) {
      setMatches([])
      setLoading(false)
      setFailed(false)
      setLimited(false)
      setError(null)
      return
    }
    let alive = true
    setMatches([])
    setLoading(true)
    setFailed(false)
    setLimited(false)
    setError(null)
    const timer = window.setTimeout(() => {
      window.crew
        .searchFiles({
          query,
          matchCase: form.matchCase,
          wholeWord: form.wholeWord,
          regex: form.regex,
          include: form.include,
          exclude: form.exclude,
          refresh: revision > 0
        })
        .then(result => {
          if (!alive) return
          setMatches(result.matches)
          setLimited(result.limited)
          setError(result.error)
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
  }, [
    form.query,
    form.matchCase,
    form.wholeWord,
    form.regex,
    form.include,
    form.exclude,
    generation,
    revision,
    cleared
  ])

  return { matches, loading, failed, limited, error }
}

function PathMatch({ tab, match, dir }: { tab: BrowserTab; match: FileMatch; dir: boolean }) {
  const start = match.path.lastIndexOf('/') + 1
  const name = match.path.slice(start)
  const folder = start ? match.path.slice(0, start - 1) : ''
  const { onContextMenu, menu } = useFileMenu(match.path, null, null, { showInFolder: true })
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
        className={`${row} pl-3 ${tab.path === match.path ? picked : quiet}`}
      >
        {dir ? (
          <FolderGlyph className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
        ) : (
          <FileGlyph className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
        )}
        <span className="max-w-[70%] shrink-0 truncate">
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

function ContentRow({
  tab,
  match,
  replaceOpen,
  replacing,
  onReplace
}: {
  tab: BrowserTab
  match: FileContentMatch
  replaceOpen: boolean
  replacing: boolean
  onReplace: (target: FileReplaceTarget) => void
}) {
  const { onContextMenu, menu } = useFileMenu(match.path, null, null, { showInFolder: true })
  return (
    <>
      <div className="group relative">
        <button
          onClick={event => openFile(tab, match.path, event, match.line)}
          onContextMenu={onContextMenu}
          data-content-file={match.path}
          data-content-line={match.line}
          data-content-column={match.column}
          className={`w-full py-1.5 pl-8 text-left transition-colors ${replaceOpen ? 'pr-10' : 'pr-3'} ${
            tab.path === match.path && tab.line === match.line ? picked : quiet
          }`}
        >
          <span className="block truncate font-mono text-xs text-fg-muted">
            <span className="mr-2 select-none text-fg-faint">{match.line}:{match.column}</span>
            {match.text.slice(0, match.start)}
            <span className="text-fg">{match.text.slice(match.start, match.end)}</span>
            {match.text.slice(match.end)}
          </span>
        </button>
        {replaceOpen && (
          <Tooltip label="Replace this match" className="absolute right-2 top-1/2 -translate-y-1/2">
            <button
              type="button"
              aria-label={`Replace match on line ${match.line}`}
              disabled={replacing}
              onClick={() =>
                onReplace({
                  path: match.path,
                  line: match.line,
                  column: match.column,
                  endColumn: match.endColumn
                })
              }
              className="flex h-7 w-7 items-center justify-center rounded-full text-fg/45 opacity-0 transition-[background-color,color,opacity,transform] hover:bg-fg/[0.08] hover:text-fg group-hover:opacity-100 focus:opacity-100 active:scale-90 disabled:pointer-events-none"
            >
              <PencilGlyph className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
      </div>
      {menu}
    </>
  )
}

function Heading({ children }: { children: string }) {
  return <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-fg-faint">{children}</p>
}

export default function ProjectSearch({
  tab,
  children,
  onNewFile,
  onNewFolder
}: {
  tab: BrowserTab
  children: ReactNode
  onNewFile?: () => void
  onNewFolder?: () => void
}) {
  const [form, setForm] = useState(initial)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [cleared, setCleared] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [closedFiles, setClosedFiles] = useState<Set<string>>(new Set())
  const [replacing, setReplacing] = useState(false)
  const paths = useProjectFiles(tab.generation)
  const options = useMemo(
    () => ({
      query: form.query.trim(),
      matchCase: form.matchCase,
      wholeWord: form.wholeWord,
      regex: form.regex,
      include: form.include,
      exclude: form.exclude
    }),
    [form.query, form.matchCase, form.wholeWord, form.regex, form.include, form.exclude]
  )
  const filter = useMemo(() => compileFileFilter(form.include, form.exclude), [form.include, form.exclude])
  const expressionError = useMemo(() => compileFileSearch(options).error, [options])
  const filteredPaths = useMemo(() => (paths ?? []).filter(filter.accepts), [paths, filter])
  const folders = useMemo(() => {
    const found = new Set<string>()
    for (const path of filteredPaths) {
      const parts = path.split('/').slice(0, -1)
      for (let at = 1; at <= parts.length; at++) found.add(parts.slice(0, at).join('/'))
    }
    return found
  }, [filteredPaths])
  const names = useMemo(
    () =>
      paths && form.query.trim() && !expressionError && !cleared
        ? matchFiles([...folders, ...filteredPaths], form.query, MATCH_LIMIT)
        : [],
    [paths, folders, filteredPaths, form.query, expressionError, cleared]
  )
  const content = useContentMatches(form, tab.generation, revision, cleared)
  const grouped = useMemo(() => {
    const groups = new Map<string, FileContentMatch[]>()
    for (const match of content.matches) groups.set(match.path, [...(groups.get(match.path) ?? []), match])
    return [...groups.entries()]
  }, [content.matches])
  const resultCount = names.length + content.matches.length
  const error = filter.error ?? expressionError ?? content.error

  const change = <K extends keyof FileSearchForm>(key: K, value: FileSearchForm[K]): void => {
    setForm(current => ({ ...current, [key]: value }))
    if (key !== 'replacement' && key !== 'preserveCase') {
      setCleared(false)
      setCollapsed(false)
      setClosedFiles(new Set())
    }
  }

  const replace = async (target?: FileReplaceTarget): Promise<void> => {
    if (!form.query.trim() || replacing) return
    setReplacing(true)
    const result = await window.crew
      .replaceFiles({ ...options, replacement: form.replacement, preserveCase: form.preserveCase, target })
      .catch(() => null)
    setReplacing(false)
    if (!result || result.error || result.failed.length > 0) {
      toast.fail(result?.error ?? 'Could not replace every match')
      return
    }
    if (result.replacements === 0) {
      toast('No matches to replace')
      return
    }
    toast.done(
      `${result.replacements} ${result.replacements === 1 ? 'replacement' : 'replacements'} in ${result.files} ${
        result.files === 1 ? 'file' : 'files'
      }`
    )
    setRevision(value => value + 1)
    useBrowser.getState().reloadTab(tab.id)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FileSearchControls
        form={form}
        replaceOpen={replaceOpen}
        detailsOpen={detailsOpen}
        resultCount={resultCount}
        replaceCount={content.matches.length}
        collapsed={collapsed}
        replacing={replacing}
        onChange={change}
        onReplaceOpen={() => setReplaceOpen(open => !open)}
        onDetailsOpen={() => setDetailsOpen(open => !open)}
        onRefresh={() => {
          setCleared(false)
          setRevision(value => value + 1)
        }}
        onClearResults={() => setCleared(true)}
        onCollapse={() => setCollapsed(value => !value)}
        onReplaceAll={() => void replace()}
        onNewFile={onNewFile}
        onNewFolder={onNewFolder}
      />
      <div data-file-scroll className="min-h-0 flex-1 overflow-auto pb-2">
        {!form.query.trim() && children}
        {form.query.trim() && !paths && <Loading />}
        {error && <p className="select-text px-3 py-5 text-center text-xs text-danger">{error}</p>}
        {!error && content.failed && <p className="px-3 py-5 text-center text-xs text-danger">Could not search files</p>}
        {!error && !content.failed && !cleared && form.query.trim() && (
          <>
            {names.length > 0 && <Heading>Files and folders</Heading>}
            {!collapsed && names.map(match => <PathMatch key={match.path} tab={tab} match={match} dir={folders.has(match.path)} />)}
            {grouped.length > 0 && <Heading>Contents</Heading>}
            {grouped.map(([path, matches]) => {
              const closed = collapsed || closedFiles.has(path)
              return (
                <div key={path}>
                  <button
                    type="button"
                    onClick={() =>
                      setClosedFiles(current => {
                        const next = new Set(current)
                        if (next.has(path)) next.delete(path)
                        else next.add(path)
                        return next
                      })
                    }
                    aria-expanded={!closed}
                    className="flex h-7 w-full items-center gap-1.5 px-3 text-left text-xs text-fg-secondary transition-colors hover:bg-fg/[0.04] hover:text-fg"
                  >
                    <ChevronRightGlyph className={`h-3.5 w-3.5 shrink-0 text-fg-faint transition-transform ${closed ? '' : 'rotate-90'}`} />
                    <FileGlyph className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
                    <span className="min-w-0 flex-1 truncate">{path}</span>
                    <span className="shrink-0 tabular-nums text-fg-faint">{matches.length}</span>
                  </button>
                  {!closed &&
                    matches.map(match => (
                      <ContentRow
                        key={`${match.path}:${match.line}:${match.column}`}
                        tab={tab}
                        match={match}
                        replaceOpen={replaceOpen}
                        replacing={replacing}
                        onReplace={target => void replace(target)}
                      />
                    ))}
                </div>
              )
            })}
            {content.loading && <Loading />}
            {!content.loading && paths && form.query.trim() && resultCount === 0 && <p className="px-3 py-6 text-center text-[13px] text-fg-faint">Nothing found</p>}
            {!content.loading && content.limited && <p className="px-3 py-2 text-xs text-fg-faint">Some matches are not shown</p>}
          </>
        )}
      </div>
    </div>
  )
}
