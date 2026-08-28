import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent
} from 'react'
import { fileSize } from '../../../shared/attachments'
import { canPreview, isHtml, isSvg, type FileEntry, type RepoFile } from '../../../shared/files'
import { CopyGlyph, DocGlyph, FileGlyph, FolderGlyph, PhotoGlyph } from '../icons'
import { useBrowser, type BrowserTab } from '../state/browser'
import { baselineOf } from './baseline'
import CodeRows from './CodeRows'
import Empty from './Empty'
import { breakFileLine, eraseFilePair, indentFile, pairFile } from './fileEditing'
import {
  clearFileHistory,
  createFileHistory,
  recordFileEdit,
  redoFileEdit,
  undoFileEdit,
  type FileEditKind,
  type FileSelection,
  type FileSnapshot
} from './fileHistory'
import FileTree from './FileTree'
import FindBar from './FindBar'
import { diffRows, editDoc, firstChange, joinRows, plainRows, rowAt, snap, toDoc, toShown } from './diffRows'
import { useFileMenu } from './fileMenu'
import HtmlView from './HtmlView'
import ImageView from './ImageView'
import MarkdownView from './MarkdownView'
import MediaView from './MediaView'
import { MenuItem, Popover } from './Popover'
import { bringIntoY, centerIn } from './scrollInto'
import Spinner from './Spinner'

const MAX_LINES = 5000

const fromRoot = (path: string): boolean => path.startsWith('/')

export function FileCrumbs({ tab }: { tab: BrowserTab }) {
  const parts = tab.path.split('/').filter(Boolean)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const copy = (kind: 'absolute' | 'relative'): void => {
    setMenuAt(null)
    void window.crew.copyPaths(tab.path).then(paths => navigator.clipboard.writeText(paths[kind]))
  }
  return (
    <>
      <div
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }}
        className="flex-1 min-w-0 h-9 mx-1 px-3.5 rounded-full bg-fg/[0.06] flex items-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar font-mono text-[13px] whitespace-nowrap"
      >
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
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined}>
        <MenuItem icon={<CopyGlyph />} label="Copy path" onClick={() => copy('absolute')} />
        <MenuItem icon={<CopyGlyph />} label="Copy relative path" onClick={() => copy('relative')} />
      </Popover>
    </>
  )
}

function DirRow({ tab, path, entry }: { tab: BrowserTab; path: string; entry: FileEntry }) {
  const { onContextMenu, menu } = useFileMenu(path)
  return (
    <>
      <button
        onClick={() => useBrowser.getState().navigateFile(tab.id, path)}
        onContextMenu={onContextMenu}
        data-file={entry.dir ? undefined : path}
        data-folder={entry.dir ? path : undefined}
        className="w-full flex items-center gap-2.5 px-4 h-9 text-sm text-left transition-colors hover:bg-fg/[0.04]"
      >
        {entry.dir ? (
          <FolderGlyph className="w-4 h-4 shrink-0 text-fg-muted" />
        ) : (
          <FileGlyph className="w-4 h-4 shrink-0 text-fg-faint" />
        )}
        <span className="text-fg-secondary truncate">{entry.name}</span>
      </button>
      {menu}
    </>
  )
}

function DirRows({ tab, path, entries }: { tab: BrowserTab; path: string; entries: FileEntry[] }) {
  if (entries.length === 0) {
    return <Empty icon={<FolderGlyph className="w-8 h-8 text-fg-faint" />} label="This folder is empty" />
  }
  return (
    <div data-directory-contents={path} className="py-2">
      {entries.map(entry => (
        <DirRow key={entry.name} tab={tab} path={path ? `${path}/${entry.name}` : entry.name} entry={entry} />
      ))}
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
  const [activeRow, setActiveRow] = useState<number | null>(null)
  const [readMenuAt, setReadMenuAt] = useState<{ x: number; y: number } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const codeRef = useRef<HTMLDivElement>(null)
  const caret = useRef<FileSelection | null>(null)
  const docRef = useRef('')
  const selection = useRef<FileSelection>({ start: 0, end: 0, direction: 'none' })
  const history = useRef(createFileHistory())
  const pendingInput = useRef<{
    selection: FileSelection
    shownStart: number
    inputType: string
    scrollLeft: number
  } | null>(null)
  const heldScrollLeft = useRef<number | null>(null)
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
        if (next.kind === 'file') {
          docRef.current = next.text
          setDoc(next.text)
        }
        selection.current = { start: 0, end: 0, direction: 'none' }
        caret.current = null
        pendingInput.current = null
        clearFileHistory(history.current)
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
  const writable = !!file && !file.truncated && !long
  // A file read as the page it is written to be. The words are still whatever is
  // in hand, so an edit made in the text is on the page as well.
  const reading = !!file && tab.preview && canPreview(tab.path)
  const asPage = reading && isHtml(tab.path)
  const asVector = reading && isSvg(tab.path)
  const editable = writable && !reading
  const text = writable ? doc : (file?.text ?? '')
  const baseline = hidden || reading ? null : base
  const vectorSrc = useMemo(
    () => (asVector ? (file?.preview ?? `data:image/svg+xml;utf8,${encodeURIComponent(text)}`) : ''),
    [asVector, file?.preview, text]
  )

  const rows = useMemo(() => {
    if (!file) return []
    const all = baseline === null ? plainRows(text) : diffRows(baseline, text)
    return editable ? all : all.slice(0, MAX_LINES)
  }, [file, baseline, text, editable])

  const shown = useMemo(() => joinRows(rows), [rows])
  const count = useMemo(() => rows.filter(row => row.line !== null).length, [rows])
  const gutter = `${Math.max(String(count).length, 2)}ch`

  const readSelection = (area: HTMLTextAreaElement): FileSelection => ({
    start: toDoc(rows, area.selectionStart),
    end: toDoc(rows, area.selectionEnd),
    direction: area.selectionDirection
  })

  useEffect(() => {
    if (!data) return
    const target = tab.line ?? jump
    const seen = scrolled.current
    if (seen.load === loadKey && seen.target === target) return
    const fresh = seen.load !== loadKey
    scrolled.current = { load: loadKey, target }
    if (data.kind === 'file' && target) {
      const row = bodyRef.current?.querySelector(`[data-line="${target}"]`)
      if (row instanceof HTMLElement) centerIn(row, bodyRef.current)
      return
    }
    if (fresh && bodyRef.current) bodyRef.current.scrollTop = 0
  }, [data, loadKey, tab.line, jump])

  useLayoutEffect(() => {
    const area = areaRef.current
    const body = bodyRef.current
    if (!area) return
    if (composing.current) {
      if (body && heldScrollLeft.current !== null) body.scrollLeft = heldScrollLeft.current
      heldScrollLeft.current = null
      return
    }
    if (area.value !== shown) area.value = shown
    const want = caret.current
    if (want === null) return
    caret.current = null
    const start = toShown(rows, want.start)
    const end = toShown(rows, want.end)
    const index = rowAt(rows, end).index
    last.current = end
    area.setSelectionRange(start, end, want.direction)
    selection.current = want
    if (document.activeElement === area) setActiveRow(index)
    const row = bodyRef.current?.querySelector(`[data-row="${index}"]`)
    if (row instanceof HTMLElement) bringIntoY(row, bodyRef.current)
    if (body && heldScrollLeft.current !== null) body.scrollLeft = heldScrollLeft.current
    heldScrollLeft.current = null
  }, [tick, shown, rows])

  useEffect(() => {
    const onSelection = () => {
      const area = areaRef.current
      if (!area || document.activeElement !== area) return
      if (area.selectionStart !== area.selectionEnd) return
      const at = snap(rows, area.selectionStart, area.selectionStart < last.current)
      last.current = at
      if (at !== area.selectionStart) area.setSelectionRange(at, at)
      selection.current = readSelection(area)
    }
    document.addEventListener('selectionchange', onSelection)
    return () => document.removeEventListener('selectionchange', onSelection)
  }, [rows])

  const dirty = writable && !!file && doc !== file.text

  const apply = (
    next: string,
    nextSelection?: { start: number; end: number; direction?: FileSelection['direction'] },
    kind: FileEditKind = 'command',
    beforeSelection?: FileSelection,
    startHint?: number
  ) => {
    if (heldScrollLeft.current === null) heldScrollLeft.current = bodyRef.current?.scrollLeft ?? null
    const area = areaRef.current
    const before = beforeSelection ?? (area ? readSelection(area) : selection.current)
    const hint = startHint ?? (area && nextSelection ? Math.min(area.selectionStart, nextSelection.start) : undefined)
    const edit = editDoc(rows, doc, shown, next, hint)
    let after: FileSelection
    if (nextSelection) {
      const nextRows = baseline === null ? plainRows(edit.text) : diffRows(baseline, edit.text)
      after = {
        start: toDoc(nextRows, nextSelection.start),
        end: toDoc(nextRows, nextSelection.end),
        direction: nextSelection.direction ?? 'none'
      }
    } else {
      after = { start: edit.at, end: edit.at, direction: 'none' }
    }
    recordFileEdit(history.current, { text: doc, selection: before }, { text: edit.text, selection: after }, kind)
    caret.current = after
    selection.current = after
    setSaveFailed(false)
    docRef.current = edit.text
    setDoc(edit.text)
    setTick(value => value + 1)
  }

  const restore = (snapshot: FileSnapshot | null) => {
    if (!snapshot) return
    heldScrollLeft.current = bodyRef.current?.scrollLeft ?? null
    caret.current = snapshot.selection
    selection.current = snapshot.selection
    pendingInput.current = null
    setSaveFailed(false)
    docRef.current = snapshot.text
    setDoc(snapshot.text)
    setTick(value => value + 1)
  }

  const undo = () => restore(undoFileEdit(history.current, docRef.current))

  const redo = () => restore(redoFileEdit(history.current, docRef.current))

  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const onCommand = (event: Event) => {
      const command = (event as CustomEvent).detail
      if (command === 'undo') undo()
      if (command === 'redo') redo()
    }
    area.addEventListener('crew-edit-command', onCommand)
    return () => area.removeEventListener('crew-edit-command', onCommand)
  }, [editable, doc])

  const save = async () => {
    if (saving || !dirty) return
    setSaving(true)
    const writing = docRef.current
    const fresh = await window.crew.writeFile(tab.path, writing).catch(() => null)
    setSaving(false)
    if (fresh?.kind === 'file') {
      setData(fresh)
      if (docRef.current === writing) {
        docRef.current = fresh.text
        setDoc(fresh.text)
      }
      setSaveFailed(false)
    } else {
      setSaveFailed(true)
    }
  }

  const discard = () => {
    if (!file) return
    const area = areaRef.current
    const at = area ? toDoc(rows, area.selectionStart) : 0
    apply(file.text, undefined, 'command', { start: at, end: at, direction: 'none' })
  }

  const kindOf = (inputType: string): FileEditKind => {
    if (inputType === 'insertText') return 'type'
    if (inputType.includes('Composition')) return 'composition'
    if (inputType.includes('Backward')) return 'delete-backward'
    if (inputType.includes('Forward')) return 'delete-forward'
    return 'command'
  }

  const onBeforeEdit = (event: FormEvent<HTMLTextAreaElement>) => {
    const inputType = (event.nativeEvent as InputEvent).inputType ?? ''
    if (inputType === 'historyUndo' || inputType === 'historyRedo') {
      event.preventDefault()
      if (inputType === 'historyUndo') undo()
      else redo()
      return
    }
    const scrollLeft = bodyRef.current?.scrollLeft ?? 0
    heldScrollLeft.current = scrollLeft
    pendingInput.current = {
      selection: readSelection(event.currentTarget),
      shownStart: event.currentTarget.selectionStart,
      inputType,
      scrollLeft
    }
  }

  const onEdit = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const pending = pendingInput.current
    pendingInput.current = null
    if (pending) heldScrollLeft.current = pending.scrollLeft
    const inputType = pending?.inputType || (event.nativeEvent as InputEvent).inputType || ''
    const nextSelection = {
      start: event.target.selectionStart,
      end: event.target.selectionEnd,
      direction: event.target.selectionDirection
    }
    const startHint = pending ? Math.min(pending.shownStart, nextSelection.start) : undefined
    apply(event.target.value, nextSelection, kindOf(inputType), pending?.selection ?? selection.current, startHint)
  }

  const placeActiveRow = (area: HTMLTextAreaElement) => {
    selection.current = readSelection(area)
    setActiveRow(rowAt(rows, area.selectionEnd).index)
  }

  const onKeys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const command = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
    if (command && !event.altKey && ((key === 'z' && !event.shiftKey) || key === 'y')) {
      event.preventDefault()
      if (key === 'z') undo()
      else redo()
      return
    }
    if (command && !event.altKey && key === 'z' && event.shiftKey) {
      event.preventDefault()
      redo()
      return
    }
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
    if (event.key === 'Backspace' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const { selectionStart, selectionEnd, value } = event.currentTarget
      const edit = eraseFilePair(value, selectionStart, selectionEnd)
      if (edit) {
        event.preventDefault()
        apply(edit.value, { ...edit, direction: event.currentTarget.selectionDirection }, 'command')
      }
      return
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      const { selectionStart, selectionEnd, value } = event.currentTarget
      const edit = pairFile(value, selectionStart, selectionEnd, event.key)
      if (edit) {
        event.preventDefault()
        apply(edit.value, { ...edit, direction: event.currentTarget.selectionDirection }, 'command')
        return
      }
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const { selectionStart, selectionEnd, value } = event.currentTarget
      const edit = indentFile(value, selectionStart, selectionEnd, event.shiftKey)
      apply(edit.value, { ...edit, direction: event.currentTarget.selectionDirection }, 'command')
      return
    }
    if (event.key === 'Enter' && !composing.current && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      const { selectionStart, selectionEnd, value } = event.currentTarget
      const edit = breakFileLine(value, selectionStart, selectionEnd)
      apply(edit.value, { ...edit, direction: event.currentTarget.selectionDirection }, 'command')
    }
  }

  return (
    <div
      className="absolute inset-0 bg-ink-900 flex"
      style={{ visibility: active ? 'visible' : 'hidden' }}
      onContextMenu={
        file && isSvg(tab.path)
          ? event => {
              event.preventDefault()
              event.stopPropagation()
              setReadMenuAt({ x: event.clientX, y: event.clientY })
            }
          : undefined
      }
    >
      <div className="relative flex-1 min-w-0">
        <div ref={bodyRef} className="absolute inset-0 overflow-auto">
          {!data && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size={20} className="text-fg-muted" />
            </div>
          )}
          {data?.kind === 'dir' &&
            (tab.tree && data.path === '' ? (
              <Empty icon={<FolderGlyph className="w-8 h-8 text-fg-faint" />} label="Pick a file from the project" />
            ) : (
              <DirRows tab={tab} path={data.path} entries={data.entries} />
            ))}
          {file && reading && !asPage && !asVector && (
            <MarkdownView path={tab.path} text={text} partial={file.truncated || long} />
          )}
          {file && asVector && <ImageView src={vectorSrc} alt={tab.path} copyable={false} />}
          {file && !reading && (
            <div
              ref={codeRef}
              data-find-scope
              className="relative min-h-full py-3 min-w-max font-mono text-xs leading-5 select-text"
            >
              <CodeRows
                path={tab.path}
                rows={rows}
                gutter={gutter}
                line={tab.line}
                dirty={dirty}
                activeRow={activeRow}
              />
              {editable && (
                <textarea
                  ref={areaRef}
                  value={shown}
                  onBeforeInput={onBeforeEdit}
                  onChange={onEdit}
                  onKeyDown={onKeys}
                  onFocus={event => placeActiveRow(event.currentTarget)}
                  onSelect={event => placeActiveRow(event.currentTarget)}
                  onBlur={() => setActiveRow(null)}
                  onCompositionStart={() => {
                    composing.current = true
                  }}
                  onCompositionEnd={() => {
                    composing.current = false
                    setTick(value => value + 1)
                  }}
                  aria-label="File contents"
                  data-edit-history="file"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  wrap="off"
                  style={{ padding: `12px 16px 12px calc(2rem + ${gutter})` }}
                  className="absolute inset-0 w-full h-full resize-none overflow-hidden bg-transparent font-mono text-xs leading-5 text-transparent caret-fg selection:bg-fg/25 outline-none"
                />
              )}
              {!editable && (file.truncated || long) && (
                <p className="select-none px-4 pt-3 text-xs text-fg-muted font-sans">
                  Showing the beginning of this file
                </p>
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
              detail={`${data.path} · ${fileSize(data.size)}`}
            />
          )}
        </div>
        {file && asPage && <HtmlView id={tab.id} path={tab.path} text={text} partial={file.truncated || long} />}
        {file && !reading && active && (
          <FindBar
            containerRef={codeRef}
            scrollerRef={bodyRef}
            placeholder="Find in this file"
            className="top-4 right-4"
            selector="[data-code-text]"
          />
        )}
        {data?.kind === 'media' && <MediaView path={data.path} src={data.url} video={data.video} />}
        {((base && !reading) || dirty) && (
          <div className="absolute top-2.5 right-4 flex items-center gap-1.5">
            {saveFailed && <span className="text-xs text-danger mr-1">Could not save</span>}
            {base && !reading && (
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
                className="h-8 px-3.5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-1.5 transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:opacity-60 disabled:scale-100"
              >
                {saving && <Spinner size={12} className="text-ink-900" />}
                Save
              </button>
            )}
          </div>
        )}
      </div>
      {tab.tree && <FileTree tab={tab} />}
      <Popover open={readMenuAt !== null} onClose={() => setReadMenuAt(null)} at={readMenuAt ?? undefined}>
        <MenuItem
          icon={tab.preview ? <DocGlyph /> : <PhotoGlyph />}
          label={tab.preview ? 'Show contents' : 'Show preview'}
          onClick={() => {
            setReadMenuAt(null)
            useBrowser.getState().togglePreview(tab.id)
          }}
        />
      </Popover>
    </div>
  )
}
