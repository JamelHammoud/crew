import { useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
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
export const FILE_DROP_EXPAND_MS = 700
const FILE_DROP_SCROLL_EDGE = 84
const FILE_DROP_SCROLL_MAX = 32
export const DEFAULT_FILE_TREE_WIDTH = 288
export const MIN_FILE_TREE_WIDTH = 220
export const MAX_FILE_TREE_WIDTH = 520
const row = 'mb-px w-full h-7 pr-2 flex items-center gap-1.5 text-[13px] text-left transition-colors'
const quiet = 'text-fg-secondary hover:bg-fg/[0.04] hover:text-fg'
const picked = 'bg-fg/[0.06] text-fg'

const indent = (depth: number): string => `${8 + depth * 14}px`

export function fileDropScrollSpeed(pointer: number, top: number, bottom: number): number {
  const fromTop = pointer - top
  const fromBottom = bottom - pointer
  if (fromTop <= fromBottom && fromTop < FILE_DROP_SCROLL_EDGE) {
    return -FILE_DROP_SCROLL_MAX * Math.min(1, Math.max(0, 1 - fromTop / FILE_DROP_SCROLL_EDGE))
  }
  if (fromBottom < FILE_DROP_SCROLL_EDGE) {
    return FILE_DROP_SCROLL_MAX * Math.min(1, Math.max(0, 1 - fromBottom / FILE_DROP_SCROLL_EDGE))
  }
  return 0
}

interface EntryDraft {
  parent: string
  kind: RepoEntryKind
}

interface FileMove {
  dragged: string | null
  dropTarget: string | null
  start: (event: DragEvent<HTMLElement>, path: string) => void
  end: () => void
  over: (event: DragEvent<HTMLElement>, parent: string) => void
  leave: (event: DragEvent<HTMLElement>, parent: string) => void
  drop: (event: DragEvent<HTMLElement>, parent: string) => void
}

const carriesFiles = (event: DragEvent<HTMLElement>): boolean =>
  Array.from(event.dataTransfer.types).includes('Files')

function droppedPaths(files: FileList): string[] {
  return Array.from(files).flatMap(file => {
    try {
      const source = window.crew.filePath(file)
      return source ? [source] : []
    } catch {
      return []
    }
  })
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
  move,
  onCreate,
  onCreated,
  onCancel
}: {
  tab: BrowserTab
  path: string
  name: string
  depth: number
  creating: EntryDraft | null
  move: FileMove
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
        draggable
        onDragStart={event => move.start(event, path)}
        onDragEnd={move.end}
        onDragOver={event => move.over(event, path)}
        onDragLeave={event => move.leave(event, path)}
        onDrop={event => move.drop(event, path)}
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
        className={`${row} ${quiet} ${
          move.dropTarget === path ? 'bg-fg/[0.08] text-fg ring-1 ring-inset ring-fg/20' : ''
        } ${move.dragged === path ? 'opacity-45' : ''} ${
          open
            ? "sticky bg-ink-900 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink-900 after:content-['']"
            : ''
        }`}
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
          move={move}
          onCreate={onCreate}
          onCreated={onCreated}
          onCancel={onCancel}
        />
      )}
      {menu}
    </div>
  )
}

function Leaf({
  tab,
  path,
  name,
  depth,
  parent,
  move
}: {
  tab: BrowserTab
  path: string
  name: string
  depth: number
  parent: string
  move: FileMove
}) {
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
        draggable
        onDragStart={event => move.start(event, path)}
        onDragEnd={move.end}
        onDragOver={event => move.over(event, parent)}
        onDragLeave={event => move.leave(event, parent)}
        onDrop={event => move.drop(event, parent)}
        onClick={event => openFile(tab, path, event)}
        onContextMenu={onContextMenu}
        data-file={path}
        style={{ paddingLeft: indent(depth) }}
        className={`${row} ${showing ? picked : quiet} ${move.dragged === path ? 'opacity-45' : ''}`}
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
    <form
      onSubmit={event => void submit(event)}
      className="mb-px flex h-7 w-full items-center gap-1.5 pr-2"
      style={{ paddingLeft: indent(depth) }}
    >
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
  move,
  onCreate,
  onCreated,
  onCancel
}: {
  tab: BrowserTab
  path: string
  depth: number
  creating: EntryDraft | null
  move: FileMove
  onCreate: (parent: string, kind: RepoEntryKind) => void
  onCreated: (path: string, kind: RepoEntryKind) => void
  onCancel: () => void
}) {
  const entries = useEntries(path, tab.generation)

  if (!entries) return <Loading depth={depth} />
  const empty = entries.length === 0 && depth === 0 && creating?.parent !== path
  return (
    <div
      data-file-branch={path}
      onDragOver={depth === 0 ? event => move.over(event, '') : undefined}
      onDragLeave={depth === 0 ? event => move.leave(event, '') : undefined}
      onDrop={depth === 0 ? event => move.drop(event, '') : undefined}
      className={`${depth === 0 ? 'min-h-full' : ''} ${move.dropTarget === '' ? 'bg-fg/[0.025]' : ''}`}
    >
      {empty ? (
        <p className="px-3 py-6 text-center text-[13px] text-fg-faint">Open a project to see its files</p>
      ) : (
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
                move={move}
                onCreate={onCreate}
                onCreated={onCreated}
                onCancel={onCancel}
              />
            ) : (
              <Leaf key={child} tab={tab} path={child} name={entry.name} depth={depth} parent={path} move={move} />
            )
          })}
        </>
      )}
    </div>
  )
}

export default function FileTree({ tab }: { tab: BrowserTab }) {
  const tree = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(DEFAULT_FILE_TREE_WIDTH)
  const [creating, setCreating] = useState<EntryDraft | null>(null)
  const [dragged, setDragged] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const moving = useRef(false)
  const expandTimer = useRef<number | null>(null)
  const expanding = useRef<string | null>(null)
  const scrollFrame = useRef<number | null>(null)
  const scrollPointer = useRef<number | null>(null)
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

  const canDrop = (event: DragEvent<HTMLElement>, parent: string): boolean => {
    if (moving.current) return false
    if (!dragged) return carriesFiles(event)
    const currentParent = dragged.includes('/') ? dragged.slice(0, dragged.lastIndexOf('/')) : ''
    if (currentParent === parent) return false
    if (parent === dragged || parent.startsWith(`${dragged}/`)) return false
    return true
  }

  const stopExpanding = (): void => {
    if (expandTimer.current !== null) window.clearTimeout(expandTimer.current)
    expandTimer.current = null
    expanding.current = null
  }

  const expandAfterPause = (parent: string): void => {
    if (!parent || tab.open.includes(parent) || expanding.current === parent) return
    stopExpanding()
    expanding.current = parent
    expandTimer.current = window.setTimeout(() => {
      if (expanding.current === parent) useBrowser.getState().toggleFolder(tab.id, parent)
      expandTimer.current = null
      expanding.current = null
    }, FILE_DROP_EXPAND_MS)
  }

  const stopDragScroll = (): void => {
    if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current)
    scrollFrame.current = null
    scrollPointer.current = null
  }

  const dragScrollFrame = (): void => {
    const host = tree.current?.querySelector<HTMLElement>('[data-file-scroll]')
    if (!host || scrollPointer.current === null) {
      stopDragScroll()
      return
    }
    const bounds = host.getBoundingClientRect()
    const speed = fileDropScrollSpeed(scrollPointer.current, bounds.top, bounds.bottom)
    if (speed === 0) {
      stopDragScroll()
      return
    }
    const before = host.scrollTop
    host.scrollTop += speed
    if (host.scrollTop === before) {
      stopDragScroll()
      return
    }
    scrollFrame.current = window.requestAnimationFrame(dragScrollFrame)
  }

  const dragScroll = (clientY: number): void => {
    scrollPointer.current = clientY
    if (scrollFrame.current === null) scrollFrame.current = window.requestAnimationFrame(dragScrollFrame)
  }

  useEffect(
    () => () => {
      if (expandTimer.current !== null) window.clearTimeout(expandTimer.current)
      if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current)
    },
    []
  )

  const move: FileMove = {
    dragged,
    dropTarget,
    start: (event, path) => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('application/x-crew-file-entry', path)
      setDragged(path)
      setCreating(null)
    },
    end: () => {
      stopExpanding()
      stopDragScroll()
      if (!moving.current) setDragged(null)
      setDropTarget(null)
    },
    over: (event, parent) => {
      event.stopPropagation()
      if (!canDrop(event, parent)) {
        if (dropTarget === parent) setDropTarget(null)
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = dragged ? 'move' : 'copy'
      setDropTarget(parent)
      expandAfterPause(parent)
    },
    leave: (event, parent) => {
      event.stopPropagation()
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
      if (dropTarget === parent) stopExpanding()
      if (dropTarget === parent) setDropTarget(null)
    },
    drop: (event, parent) => {
      event.preventDefault()
      event.stopPropagation()
      const source = dragged
      if (!canDrop(event, parent)) return
      const sources = source ? [] : droppedPaths(event.dataTransfer.files)
      if (!source && sources.length === 0) return
      stopExpanding()
      stopDragScroll()
      moving.current = true
      setDropTarget(null)
      const operation = source ? window.crew.moveEntry(source, parent) : window.crew.importEntries(sources, parent)
      void operation
        .then(result => {
          if (!result.ok) {
            toast.fail(result.message)
            return
          }
          if (source && 'path' in result) useBrowser.getState().moveFilePaths(source, result.path)
          else useBrowser.getState().reloadTab(tab.id)
          if (
            parent &&
            !useBrowser
              .getState()
              .tabs.find(one => one.id === tab.id)
              ?.open.includes(parent)
          ) {
            useBrowser.getState().toggleFolder(tab.id, parent)
          }
        })
        .catch(() => toast.fail(source ? 'Could not move that item' : 'Could not copy that item'))
        .finally(() => {
          moving.current = false
          setDragged(null)
        })
    }
  }

  return (
    <aside
      ref={tree}
      data-file-tree-width={width}
      style={{ width }}
      onDragOverCapture={event => {
        if (!dragged && !carriesFiles(event)) return
        event.preventDefault()
        dragScroll(event.clientY)
      }}
      onDragOver={event => move.over(event, '')}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) stopDragScroll()
        move.leave(event, '')
      }}
      onDrop={event => move.drop(event, '')}
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
          move={move}
          onCreate={startCreate}
          onCreated={created}
          onCancel={() => setCreating(null)}
        />
      </ProjectSearch>
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </aside>
  )
}
