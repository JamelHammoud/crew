import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent
} from 'react'
import type { FileEntry, RepoFile } from '../../../shared/files'
import { DocGlyph, FileGlyph, FolderGlyph } from '../icons'
import { useBrowser, type BrowserTab } from '../state/browser'
import { baselineOf } from './baseline'
import CodeRows from './CodeRows'
import FileTree from './FileTree'
import { diffRows, editDoc, firstChange, joinRows, plainRows, rowAt, snap, toDoc, toShown } from './diffRows'
import ImageView from './ImageView'
import Spinner from './Spinner'

const MAX_LINES = 5000

const fromRoot = (path: string): boolean => path.startsWith('/')

export function FileCrumbs({ tab }: { tab: BrowserTab }) {
  const parts = tab.path.split('/').filter(Boolean)
  return (
    <div className="flex-1 min-w-0 h-9 mx-1 px-3.5 rounded-full bg-fg/[0.06] flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] font-mono text-[13px] whitespace-nowrap">
      <button
        onClick={() => useBrowser.getState().navigateFile(tab.id, '')}
        aria-label="Project files"
        className={`shrink-0 transition-colors ${parts.length === 0 ? 'text-fg' : 'text-fg-muted hover:text-fg'}`}
      >
        <FolderGlyph className="w-4 h-4" />
      </button>
      {parts.map((part, index) => {
        const prefix = (fromRoot(tab.path) ? '/' : '') + parts.slice(0, index + 1).join('/')
        const last = index === parts.length - 1
        return (
          <span key={prefix} className="flex items-center gap-1.5 shrink-0">
            <span className="text-fg-faint">/</span>
            {last ? (
              <span className="text-fg">{part}</span>
            ) : (
              <button
                onClick={() => useBrowser.getState().navigateFile(tab.id, prefix)}
                className="text-fg-muted hover:text-fg transition-colors"
              >
                {part}
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}

function DirRows({ tab, path, entries }: { tab: BrowserTab; path: string; entries: FileEntry[] }) {
  if (entries.length === 0) {
    return <Empty icon={<FolderGlyph className="w-8 h-8 text-fg-faint" />} label="This folder is empty" />
  }
  return (
    <div className="py-2">
      {entries.map(entry => (
        <button
          key={entry.name}
          onClick={() => useBrowser.getState().navigateFile(tab.id, path ? `${path}/${entry.name}` : entry.name)}
          className="w-full flex items-center gap-2.5 px-4 h-9 text-sm text-left transition-colors hover:bg-fg/[0.04]"
        >
          {entry.dir ? (
            <FolderGlyph className="w-4 h-4 shrink-0 text-fg-muted" />
          ) : (
            <FileGlyph className="w-4 h-4 shrink-0 text-fg-faint" />
          )}
          <span className="text-fg-secondary truncate">{entry.name}</span>
        </button>
      ))}
    </div>
  )
}

function Empty({ icon, label, detail }: { icon: React.ReactNode; label: string; detail?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
      {icon}
      <p className="text-sm text-fg-muted">{label}</p>
      {detail && <p className="text-xs font-mono text-fg-faint break-all text-center">{detail}</p>}
    </div>
  )
}

export default function FileView({ tab, active }: { tab: BrowserTab; active: boolean }) {
  const [data, setData] = useState<RepoFile | null>(null)
  const [doc, setDoc] = useState('')
  const [base, setBase] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)
  const [jump, setJump] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const [loadKey, setLoadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<number | null>(null)
  const last = useRef(0)
  const composing = useRef(false)
  const scrolled = useRef<{ load: number; target: number | null }>({ load: -1, target: null })

  useEffect(() => {
    let alive = true
    window.crew
      .readFile(tab.path)
      .then(result => {
        if (!alive) return
        const next = result ?? { kind: 'missing' as const, path: tab.path }
        const start = next.kind === 'file' ? baselineOf(next.text, tab.diff) : null
        setData(next)
        setBase(start)
        setHidden(false)
        setJump(next.kind === 'file' && start ? firstChange(diffRows(start, next.text)) : null)
        if (next.kind === 'file') setDoc(next.text)
        setSaveFailed(false)
        setLoadKey(key => key + 1)
      })
      .catch(() => {
        if (!alive) return
        setData({ kind: 'missing', path: tab.path })
        setLoadKey(key => key + 1)
      })
    return () => {
      alive = false
    }
  }, [tab.path, tab.generation, tab.diff])

  const file = data?.kind === 'file' ? data : null
  const long = !!file && file.text.split('\n').length > MAX_LINES
  const editable = !!file && !file.truncated && !long
  const text = editable ? doc : (file?.text ?? '')
  const baseline = hidden ? null : base

  const rows = useMemo(() => {
    if (!file) return []
    const all = baseline === null ? plainRows(text) : diffRows(baseline, text)
    return editable ? all : all.slice(0, MAX_LINES)
  }, [file, baseline, text, editable])

  const shown = useMemo(() => joinRows(rows), [rows])
  const count = useMemo(() => rows.filter(row => row.line !== null).length, [rows])
  const gutter = `${Math.max(String(count).length, 2)}ch`

  useEffect(() => {
    if (!data) return
    const target = tab.line ?? jump
    const seen = scrolled.current
    if (seen.load === loadKey && seen.target === target) return
    const fresh = seen.load !== loadKey
    scrolled.current = { load: loadKey, target }
    if (data.kind === 'file' && target) {
      bodyRef.current?.querySelector(`[data-line="${target}"]`)?.scrollIntoView?.({ block: 'center' })
      return
    }
    if (fresh && bodyRef.current) bodyRef.current.scrollTop = 0
  }, [data, loadKey, tab.line, jump])

  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area || composing.current) return
    if (area.value !== shown) area.value = shown
    const want = caret.current
    if (want === null) return
    caret.current = null
    const at = toShown(rows, want)
    last.current = at
    area.setSelectionRange(at, at)
    bodyRef.current?.querySelector(`[data-row="${rowAt(rows, at).index}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [tick, shown, rows])

  useEffect(() => {
    const onSelection = () => {
      const area = areaRef.current
      if (!area || document.activeElement !== area) return
      if (area.selectionStart !== area.selectionEnd) return
      const at = snap(rows, area.selectionStart, area.selectionStart < last.current)
      last.current = at
      if (at !== area.selectionStart) area.setSelectionRange(at, at)
    }
    document.addEventListener('selectionchange', onSelection)
    return () => document.removeEventListener('selectionchange', onSelection)
  }, [rows])

  const dirty = editable && !!file && doc !== file.text

  const apply = (next: string) => {
    const edit = editDoc(rows, doc, shown, next)
    caret.current = edit.at
    setSaveFailed(false)
    setDoc(edit.text)
    setTick(value => value + 1)
  }

  const save = async () => {
    if (saving || !dirty) return
    setSaving(true)
    const fresh = await window.crew.writeFile(tab.path, doc).catch(() => null)
    setSaving(false)
    if (fresh?.kind === 'file') {
      setData(fresh)
      setDoc(fresh.text)
      setSaveFailed(false)
    } else {
      setSaveFailed(true)
    }
  }

  const discard = () => {
    if (!file) return
    const area = areaRef.current
    caret.current = area ? toDoc(rows, area.selectionStart) : 0
    setDoc(file.text)
    setTick(value => value + 1)
    setSaveFailed(false)
  }

  const onEdit = (event: ChangeEvent<HTMLTextAreaElement>) => apply(event.target.value)

  const onKeys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault()
      void save()
      return
    }
    if (event.key === 'Escape') {
      if (dirty) {
        event.preventDefault()
        discard()
      }
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const { selectionStart, selectionEnd, value } = event.currentTarget
      apply(`${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`)
    }
  }

  return (
    <div className="absolute inset-0 bg-ink-900 flex" style={{ visibility: active ? 'visible' : 'hidden' }}>
      <div className="relative flex-1 min-w-0">
        <div ref={bodyRef} className="absolute inset-0 overflow-auto">
          {!data && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size={20} className="text-fg-muted" />
            </div>
          )}
          {data?.kind === 'dir' &&
            (tab.tree ? (
              <Empty icon={<FolderGlyph className="w-8 h-8 text-fg-faint" />} label="Pick a file from the project" />
            ) : (
              <DirRows tab={tab} path={data.path} entries={data.entries} />
            ))}
          {file && (
            <div className="relative min-h-full py-3 min-w-max font-mono text-xs leading-5 select-text">
              <CodeRows path={tab.path} rows={rows} gutter={gutter} line={tab.line} dirty={dirty} />
              {editable && (
                <textarea
                  ref={areaRef}
                  value={shown}
                  onChange={onEdit}
                  onKeyDown={onKeys}
                  onCompositionStart={() => {
                    composing.current = true
                  }}
                  onCompositionEnd={() => {
                    composing.current = false
                  }}
                  aria-label="File contents"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  wrap="off"
                  style={{ padding: `12px 16px 12px calc(2rem + ${gutter})` }}
                  className="absolute inset-0 w-full h-full resize-none overflow-hidden bg-transparent font-mono text-xs leading-5 text-transparent caret-fg selection:bg-fg/25 outline-none"
                />
              )}
              {!editable && (file.truncated || long) && (
                <p className="select-none px-4 pt-3 text-xs text-fg-muted font-sans">Showing the beginning of this file</p>
              )}
            </div>
          )}
          {data?.kind === 'image' && <ImageView src={data.url} alt={data.path} />}
          {data?.kind === 'missing' && (
            <Empty
              icon={<FileGlyph className="w-8 h-8 text-fg-faint" />}
              label={fromRoot(data.path) ? 'This file is not on this computer' : 'This file is not in the project'}
              detail={data.path}
            />
          )}
          {data?.kind === 'binary' && (
            <Empty
              icon={<DocGlyph className="w-8 h-8 text-fg-faint" />}
              label="No preview for this file"
              detail={`${data.path} · ${Math.max(1, Math.round(data.size / 1024))} KB`}
            />
          )}
        </div>
        {(base || dirty) && (
          <div className="absolute top-2.5 right-4 flex items-center gap-1.5">
            {saveFailed && <span className="text-xs text-danger mr-1">Could not save</span>}
            {base && (
              <button
                onClick={() => setHidden(!hidden)}
                className="glass h-8 px-3.5 rounded-full text-sm text-fg-secondary transition-all duration-150 hover:text-fg active:scale-95"
              >
                {hidden ? 'Show changes' : 'Hide changes'}
              </button>
            )}
            {dirty && (
              <button
                onClick={discard}
                className="glass h-8 px-3.5 rounded-full text-sm text-fg-secondary transition-all duration-150 hover:text-fg active:scale-95"
              >
                Discard
              </button>
            )}
            {dirty && (
              <button
                onClick={() => void save()}
                disabled={saving}
                className="h-8 px-3.5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-1.5 transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100"
              >
                {saving && <Spinner size={12} className="text-ink-900" />}
                Save
              </button>
            )}
          </div>
        )}
      </div>
      {tab.tree && <FileTree tab={tab} />}
    </div>
  )
}
