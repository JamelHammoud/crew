import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { FileEntry } from '../../../shared/files'
import { ChevronRightGlyph, FileGlyph } from '../icons'
import { useBrowser, type BrowserTab } from '../state/browser'
import { useFileMenu } from './fileMenu'
import ProjectSearch from './ProjectSearch'
import { bringInto } from './scrollInto'
import Skeleton from './Skeleton'

const ROW_STEP = 29
const row = 'mb-px w-full h-7 pr-2 flex items-center gap-1.5 text-[13px] text-left transition-colors'
const quiet = 'text-fg-secondary hover:bg-fg/[0.04] hover:text-fg'
const picked = 'bg-fg/[0.06] text-fg'

const indent = (depth: number): string => `${8 + depth * 14}px`

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

function Folder({ tab, path, name, depth }: { tab: BrowserTab; path: string; name: string; depth: number }) {
  const open = tab.open.includes(path)
  const { onContextMenu, menu } = useFileMenu(path)
  return (
    <div data-folder-branch={path}>
      <button
        onClick={() => useBrowser.getState().toggleFolder(tab.id, path)}
        onContextMenu={onContextMenu}
        data-folder={path}
        data-sticky-folder={open ? path : undefined}
        aria-expanded={open}
        style={{ paddingLeft: indent(depth), top: open ? depth * ROW_STEP : undefined, zIndex: open ? 10 + depth : undefined }}
        className={`${row} ${quiet} ${open ? 'sticky bg-ink-900' : ''}`}
      >
        <ChevronRightGlyph
          className={`h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
        <span className="truncate">{name}</span>
      </button>
      {open && <Branch tab={tab} path={path} depth={depth + 1} />}
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

function Branch({ tab, path, depth }: { tab: BrowserTab; path: string; depth: number }) {
  const entries = useEntries(path, tab.generation)

  if (!entries) return <Loading depth={depth} />
  if (entries.length === 0 && depth === 0) {
    return <p className="px-3 py-6 text-center text-[13px] text-fg-faint">Open a project to see its files</p>
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

export default function FileTree({ tab }: { tab: BrowserTab }) {
  return (
    <aside className="flex w-[42%] min-w-[220px] max-w-[340px] shrink-0 flex-col border-l border-ink-700">
      <ProjectSearch tab={tab}>
        <Branch tab={tab} path="" depth={0} />
      </ProjectSearch>
    </aside>
  )
}
