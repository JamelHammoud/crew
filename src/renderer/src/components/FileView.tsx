import { DocumentIcon, DocumentTextIcon, FolderIcon } from '@heroicons/react/16/solid'
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject
} from 'react'
import type { FileEntry, RepoFile } from '../../../shared/files'
import { useBrowser, type BrowserTab } from '../state/browser'
import { useTheme } from '../state/theme'
import { changedLines, type ChangedLines } from './changedLines'
import { highlightLines, type ThemedToken } from './highlight'
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
        <FolderIcon className="w-4 h-4" />
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
    return <Empty icon={<FolderIcon className="w-8 h-8 text-fg-faint" />} label="This folder is empty" />
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
            <FolderIcon className="w-4 h-4 shrink-0 text-fg-muted" />
          ) : (
            <DocumentIcon className="w-4 h-4 shrink-0 text-fg-faint" />
          )}
          <span className="text-fg-secondary truncate">{entry.name}</span>
        </button>
      ))}
    </div>
  )
}

function LineText({ content, tokens }: { content: string; tokens: ThemedToken[] | undefined }) {
  if (!tokens?.length) return <>{content}</>
  return (
    <>
      {tokens.map((token, index) => (
        <span key={index} style={token.color ? { color: token.color } : undefined}>
          {token.content}
        </span>
      ))}
    </>
  )
}

type Highlight = { lines: string[]; byLine: ThemedToken[][] }

type Spot = { line: number; column: number; top: number }

function columnAt(row: Element, x: number, y: number): number {
  const text = row.lastElementChild
  if (!text) return 0
  const end = text.textContent?.length ?? 0
  const point = document.caretRangeFromPoint?.(x, y)
  if (!point) return end
  if (point.startContainer !== text && !text.contains(point.startContainer)) {
    return x < text.getBoundingClientRect().left ? 0 : end
  }
  const upto = document.createRange()
  upto.setStart(text, 0)
  upto.setEnd(point.startContainer, point.startOffset)
  return upto.toString().length
}

function spotAt(event: MouseEvent<HTMLDivElement>): Spot | null {
  const hit = (event.target as HTMLElement).closest?.('[data-line], [data-gone]') ?? null
  let row: Element | null = hit
  while (row && !row.hasAttribute('data-line')) row = row.nextElementSibling
  if (!hit || !row) return null
  return {
    line: Number(row.getAttribute('data-line')),
    column: hit === row ? columnAt(row, event.clientX, event.clientY) : 0,
    top: row.getBoundingClientRect().top
  }
}

function GoneLines({ lines, gutter }: { lines: string[]; gutter: string }) {
  return (
    <>
      {lines.map((content, index) => (
        <div key={index} data-gone className="flex px-4 bg-danger/10">
          <span
            style={{ minWidth: gutter }}
            className="shrink-0 mr-4 text-right select-none text-danger/60"
          >
            −
          </span>
          <span className="whitespace-pre text-fg-muted pr-4">{content}</span>
        </div>
      ))}
    </>
  )
}

function CodeBody({
  tab,
  text,
  marks,
  editable,
  truncated,
  dirty,
  onChange,
  onKeys,
  onDismiss,
  areaRef
}: {
  tab: BrowserTab
  text: string
  marks: ChangedLines | null
  editable: boolean
  truncated: boolean
  dirty: boolean
  onChange: (next: string, caretLine: number) => void
  onKeys: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onDismiss: (spot: Spot | null) => void
  areaRef: RefObject<HTMLTextAreaElement>
}) {
  const theme = useTheme()
  const [highlight, setHighlight] = useState<Highlight | null>(null)
  const all = text.split('\n')
  const lines = editable ? all : all.slice(0, MAX_LINES)
  const gutter = `${Math.max(String(lines.length).length, 2)}ch`

  useEffect(() => setHighlight(null), [tab.path, theme])

  useEffect(() => {
    let alive = true
    const source = text.split('\n').slice(0, MAX_LINES).join('\n')
    const timer = setTimeout(
      () =>
        void highlightLines(tab.path, source, theme).then(result => {
          if (alive && result) setHighlight({ lines: source.split('\n'), byLine: result })
        }),
      dirty ? 150 : 0
    )
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [tab.path, text, theme, dirty])

  return (
    <div
      onMouseDown={event => {
        if (marks) onDismiss(spotAt(event))
      }}
      className="relative min-h-full py-3 min-w-max font-mono text-xs leading-5"
    >
      <div aria-hidden={editable || undefined}>
        {lines.map((content, index) => {
          const number = index + 1
          const gone = marks?.removed.get(number)
          const added = marks?.added.has(number) === true
          const marked = tab.line === number
          return (
            <Fragment key={number}>
              {gone && <GoneLines lines={gone} gutter={gutter} />}
              <div
                data-line={number}
                className={`flex px-4 ${added ? 'bg-positive/10' : marked ? 'bg-fg/[0.07]' : ''}`}
              >
                <span
                  style={{ minWidth: gutter }}
                  className={`shrink-0 mr-4 text-right select-none tabular-nums ${
                    added || marked ? 'text-fg' : 'text-fg-faint'
                  }`}
                >
                  {number}
                </span>
                <span className="whitespace-pre text-fg-secondary pr-4">
                  <LineText
                    content={content}
                    tokens={highlight?.lines[index] === content ? highlight.byLine[index] : undefined}
                  />
                </span>
              </div>
            </Fragment>
          )
        })}
      </div>
      {editable && (
        <textarea
          ref={areaRef}
          value={text}
          onChange={event => {
            const { value, selectionStart } = event.target
            onChange(value, value.slice(0, selectionStart).split('\n').length)
          }}
          onKeyDown={onKeys}
          aria-label="File contents"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          wrap="off"
          style={{ padding: `12px 16px 12px calc(2rem + ${gutter})` }}
          className="absolute inset-0 w-full h-full resize-none overflow-hidden bg-transparent font-mono text-xs leading-5 text-transparent caret-fg selection:bg-fg/25 outline-none"
        />
      )}
      {!editable && (truncated || all.length > MAX_LINES) && (
        <p className="px-4 pt-3 text-xs text-fg-muted font-sans">Showing the beginning of this file</p>
      )}
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
  const [draft, setDraft] = useState('')
  const [loadKey, setLoadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [caret, setCaret] = useState<Spot | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const held = useRef<Spot | null>(null)
  const scrolled = useRef<{ load: number; target: number | null }>({ load: -1, target: null })

  useEffect(() => {
    let alive = true
    window.crew
      .readFile(tab.path)
      .then(result => {
        if (!alive) return
        const next = result ?? { kind: 'missing' as const, path: tab.path }
        setData(next)
        if (next.kind === 'file') setDraft(next.text)
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
  }, [tab.path, tab.generation])

  const file = data?.kind === 'file' ? data : null
  const marks = useMemo(() => (file ? changedLines(file.text, tab.diff) : null), [file, tab.diff])

  useEffect(() => {
    if (!data) return
    const target = tab.line ?? marks?.first ?? null
    const seen = scrolled.current
    if (seen.load === loadKey && seen.target === target) return
    const fresh = seen.load !== loadKey
    scrolled.current = { load: loadKey, target }
    if (data.kind === 'file' && target) {
      bodyRef.current?.querySelector(`[data-line="${target}"]`)?.scrollIntoView?.({ block: 'center' })
      return
    }
    if (fresh && bodyRef.current) bodyRef.current.scrollTop = 0
  }, [data, loadKey, tab.line, marks])

  useLayoutEffect(() => {
    const hold = held.current
    if (!hold || marks) return
    held.current = null
    const body = bodyRef.current
    const row = body?.querySelector(`[data-line="${hold.line}"]`)
    if (!body || !row) return
    body.scrollTop += row.getBoundingClientRect().top - hold.top
  }, [marks])

  const editable = !!file && !marks && !file.truncated && file.text.split('\n').length <= MAX_LINES
  const dirty = editable && !!file && draft !== file.text

  useEffect(() => {
    if (!caret) return
    setCaret(null)
    const area = areaRef.current
    if (!area) return
    const lines = draft.split('\n')
    const line = Math.min(Math.max(caret.line, 1), lines.length)
    const start = lines.slice(0, line - 1).reduce((sum, one) => sum + one.length + 1, 0)
    const offset = start + Math.min(caret.column, lines[line - 1].length)
    area.focus({ preventScroll: true })
    area.setSelectionRange(offset, offset)
  }, [caret])

  const dismiss = (spot: Spot | null) => {
    held.current = spot
    useBrowser.getState().updateTab(tab.id, { diff: null })
    setCaret(spot)
  }

  const save = async () => {
    if (saving || !dirty) return
    setSaving(true)
    const fresh = await window.crew.writeFile(tab.path, draft).catch(() => null)
    setSaving(false)
    if (fresh?.kind === 'file') {
      setData(fresh)
      setDraft(fresh.text)
      setSaveFailed(false)
    } else {
      setSaveFailed(true)
    }
  }

  const discard = () => {
    if (file) setDraft(file.text)
    setSaveFailed(false)
  }

  const onEdit = (next: string, caretLine: number) => {
    setDraft(next)
    setSaveFailed(false)
    setTimeout(() => {
      bodyRef.current?.querySelector(`[data-line="${caretLine}"]`)?.scrollIntoView?.({ block: 'nearest' })
    }, 0)
  }

  const onEditorKeys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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
      const target = event.currentTarget
      const { selectionStart, selectionEnd, value } = target
      const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`
      target.value = next
      target.setSelectionRange(selectionStart + 2, selectionStart + 2)
      setDraft(next)
    }
  }

  return (
    <div className="absolute inset-0 bg-ink-900" style={{ visibility: active ? 'visible' : 'hidden' }}>
      <div ref={bodyRef} className="absolute inset-0 overflow-auto">
        {!data && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size={20} className="text-fg-muted" />
          </div>
        )}
        {data?.kind === 'dir' && <DirRows tab={tab} path={data.path} entries={data.entries} />}
        {file && (
          <CodeBody
            tab={tab}
            text={editable ? draft : file.text}
            marks={marks}
            editable={editable}
            truncated={file.truncated}
            dirty={dirty}
            onChange={onEdit}
            onKeys={onEditorKeys}
            onDismiss={dismiss}
            areaRef={areaRef}
          />
        )}
        {data?.kind === 'image' && <ImageView src={data.url} alt={data.path} />}
        {data?.kind === 'missing' && (
          <Empty
            icon={<DocumentIcon className="w-8 h-8 text-fg-faint" />}
            label={fromRoot(data.path) ? 'This file is not on this computer' : 'This file is not in the project'}
            detail={data.path}
          />
        )}
        {data?.kind === 'binary' && (
          <Empty
            icon={<DocumentTextIcon className="w-8 h-8 text-fg-faint" />}
            label="No preview for this file"
            detail={`${data.path} · ${Math.max(1, Math.round(data.size / 1024))} KB`}
          />
        )}
      </div>
      {dirty && (
        <div className="absolute top-2.5 right-4 flex items-center gap-1.5">
          {saveFailed && <span className="text-xs text-danger mr-1">Could not save</span>}
          <button
            onClick={discard}
            className="glass h-8 px-3.5 rounded-full text-sm text-fg-secondary transition-all duration-150 hover:text-fg active:scale-95"
          >
            Discard
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="h-8 px-3.5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-1.5 transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100"
          >
            {saving && <Spinner size={12} className="text-ink-900" />}
            Save
          </button>
        </div>
      )}
    </div>
  )
}
