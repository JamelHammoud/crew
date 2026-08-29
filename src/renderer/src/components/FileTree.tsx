import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import type { FileEntry, RepoEntryKind } from '../../../shared/files'
import { ChevronRightGlyph, FileGlyph, FolderGlyph } from '../icons'
import { useBrowser, type BrowserTab } from '../state/browser'
import { toast } from '../state/toast'
import { useFileMenu } from './fileMenu'
import ProjectSearch from './ProjectSearch'
import { bringInto } from './scrollInto'
import Skeleton from './Skeleton'
import { useAutoFocus } from './useAutoFocus'
import { useColumnResize } from './useColumnResize'

const ROW_STEP = 29
export const DEFAULT_FILE_TREE_WIDTH = 288
export const MIN_FILE_TREE_WIDTH = 220
export const MAX_FILE_TREE_WIDTH = 520
const row = 'mb-px w-full h-7 pr-2 flex items-center gap-1.5 text-[13px] text-left transition-colors'
const quiet = 'text-fg-secondary hover:bg-fg/[0.04] hover:text-fg'
const picked = 'bg-fg/[0.06] text-fg'

const indent = (depth: number): string => `${8 + depth * 14}px`

interface EntryDraft {
  parent: string
  kind: RepoEntryKind
}

function openFile(tab: BrowserTab, path: string, event: MouseEvent): void {
  if (event.shiftKey) useBrowser.getState().addFileTab(path)
  else useBrowser.getState().navigateFile(tab.id, path)
}

function Loading({ depth }: { depth: number }) {
  return (
    <div className="space-y-1.5 py-1" style={{ paddingLeft: indent(depth), paddingRight: 16 }}>
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

function Folder({
  tab,
  path,
  name,
  depth,
  creating,
  onCreate,
  onCreated,
  onCancel
}: {
  tab: BrowserTab
  path: string
  name: string
  depth: number
  creating: EntryDraft | null
  onCreate: (parent: string, kind: RepoEntryKind) => void
  onCreated: (path: string, kind: RepoEntryKind) => void
  onCancel: () => void
}) {
  const open = tab.open.includes(path)
  const { onContextMenu, menu } = useFileMenu(path, null, null, {
    file: () => onCreate(path, 'file'),
    folder: () => onCreate(path, 'folder')
  })
  return (
    <div data-folder-branch={path}>
      <button
        onClick={() => useBrowser.getState().toggleFolder(tab.id, path)}
        onContextMenu={onContextMenu}
        data-folder={path}
        data-sticky-folder={open ? path : undefined}
        aria-expanded={open}
        style={{
          paddingLeft: indent(depth),
          top: open ? depth * ROW_STEP : undefined,
          zIndex: open ? tab.open.length - depth : undefined
        }}
        className={`${row} ${quiet} ${open ? "sticky bg-ink-900 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink-900 after:content-['']" : ''}`}
      >
        <ChevronRightGlyph
          className={`h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
        <span className="truncate">{name}</span>
      </button>
      {open && (
        <Branch
          tab={tab}
          path={path}
          depth={depth + 1}
          creating={creating}
          onCreate={onCreate}
          onCreated={onCreated}
          onCancel={onCancel}
        />
      )}
      {menu}
    </div>
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
        <FileGlyph className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
        <span className="truncate">{name}</span>
      </button>
      {menu}
    </>
  )
}

function CreateRow({
  draft,
  depth,
  onCreated,
  onCancel
}: {
  draft: EntryDraft
  depth: number
  onCreated: (path: string, kind: RepoEntryKind) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const input = useAutoFocus<HTMLInputElement>(true)
  const Mark = draft.kind === 'file' ? FileGlyph : FolderGlyph

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const clean = name.trim()
    if (!clean || saving) return
    if (clean === '.' || clean === '..' || clean.includes('/') || clean.includes('\\')) {
      toast.fail('Use one name at a time')
      input.current?.focus()
      return
    }
    setSaving(true)
    const target = draft.parent ? `${draft.parent}/${clean}` : clean
    const result = await window.crew.createEntry(target, draft.kind).catch(() => null)
    setSaving(false)
    if (!result?.ok) {
      toast.fail(result?.message ?? `Could not create that ${draft.kind}`)
      input.current?.focus()
      return
    }
    onCreated(result.path, draft.kind)
  }

  const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    onCancel()
  }

  return (
    <form onSubmit={event => void submit(event)} className="mb-px flex h-7 w-full items-center gap-1.5 pr-2" style={{ paddingLeft: indent(depth) }}>
      <span className="h-3.5 w-3.5 shrink-0" />
      <Mark className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
      <input
        ref={input}
        value={name}
        onChange={event => setName(event.target.value)}
        onKeyDown={keyDown}
        onBlur={onCancel}
        aria-label={draft.kind === 'file' ? 'New file name' : 'New folder name'}
        readOnly={saving}
        spellCheck={false}
        className="h-6 min-w-0 flex-1 rounded-md border border-fg/20 bg-ink-800 px-1.5 text-[13px] text-fg outline-none focus:border-fg/45 read-only:opacity-50"
      />
    </form>
  )
}

function Branch({
  tab,
  path,
  depth,
  creating,
  onCreate,
  onCreated,
  onCancel
}: {
  tab: BrowserTab
  path: string
  depth: number
  creating: EntryDraft | null
  onCreate: (parent: string, kind: RepoEntryKind) => void
  onCreated: (path: string, kind: RepoEntryKind) => void
  onCancel: () => void
}) {
  const entries = useEntries(path, tab.generation)

  if (!entries) return <Loading depth={depth} />
  if (entries.length === 0 && depth === 0 && creating?.parent !== path) {
    return <p className="px-3 py-6 text-center text-[13px] text-fg-faint">Open a project to see its files</p>
  }
  return (
    <>
      {creating?.parent === path && (
        <CreateRow draft={creating} depth={depth} onCreated={onCreated} onCancel={onCancel} />
      )}
      {entries.map(entry => {
        const child = path ? `${path}/${entry.name}` : entry.name
        return entry.dir ? (
          <Folder
            key={child}
            tab={tab}
            path={child}
            name={entry.name}
            depth={depth}
            creating={creating}
            onCreate={onCreate}
            onCreated={onCreated}
            onCancel={onCancel}
          />
        ) : (
          <Leaf key={child} tab={tab} path={child} name={entry.name} depth={depth} />
        )
      })}
    </>
  )
}

export default function FileTree({ tab }: { tab: BrowserTab }) {
  const [width, setWidth] = useState(DEFAULT_FILE_TREE_WIDTH)
  const [creating, setCreating] = useState<EntryDraft | null>(null)
  const { dragging, startResize } = useColumnResize(
    width,
    asked => setWidth(Math.max(MIN_FILE_TREE_WIDTH, Math.min(MAX_FILE_TREE_WIDTH, asked))),
    () => setWidth(DEFAULT_FILE_TREE_WIDTH)
  )

  const startCreate = (parent: string, kind: RepoEntryKind): void => {
    if (parent && !tab.open.includes(parent)) useBrowser.getState().toggleFolder(tab.id, parent)
    setCreating({ parent, kind })
  }

  const created = (path: string, kind: RepoEntryKind): void => {
    setCreating(null)
    useBrowser.getState().reloadTab(tab.id)
    if (kind === 'file') useBrowser.getState().navigateFile(tab.id, path)
  }

  return (
    <aside
      data-file-tree-width={width}
      style={{ width }}
      className={`relative flex shrink-0 flex-col border-l border-ink-700 ${dragging ? '' : 'transition-[width] duration-200'}`}
    >
      <div
        role="separator"
        aria-label="Resize files"
        aria-orientation="vertical"
        onPointerDown={startResize}
        className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize transition-colors hover:bg-fg/10"
      />
      <ProjectSearch tab={tab} onNewFile={() => startCreate('', 'file')} onNewFolder={() => startCreate('', 'folder')}>
        <Branch
          tab={tab}
          path=""
          depth={0}
          creating={creating}
          onCreate={startCreate}
          onCreated={created}
          onCancel={() => setCreating(null)}
        />
      </ProjectSearch>
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </aside>
  )
}
