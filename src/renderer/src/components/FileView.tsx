import { DocumentIcon, DocumentTextIcon, FolderIcon } from '@heroicons/react/16/solid'
import { useEffect, useRef, useState } from 'react'
import type { FileEntry, RepoFile } from '../../../shared/files'
import { useBrowser, type BrowserTab } from '../state/browser'
import Spinner from './Spinner'

const MAX_LINES = 5000

export function FileCrumbs({ tab }: { tab: BrowserTab }) {
  const parts = tab.path ? tab.path.split('/') : []
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
        const prefix = parts.slice(0, index + 1).join('/')
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

function FileLines({ text, truncated, line }: { text: string; truncated: boolean; line: number | null }) {
  const all = text.split('\n')
  const lines = all.slice(0, MAX_LINES)
  const gutter = `${Math.max(String(lines.length).length, 2)}ch`
  return (
    <div className="py-3 min-w-max font-mono text-xs leading-5">
      {lines.map((content, index) => {
        const number = index + 1
        const marked = line === number
        return (
          <div key={number} data-line={number} className={`flex px-4 ${marked ? 'bg-fg/[0.07]' : ''}`}>
            <span
              style={{ minWidth: gutter }}
              className={`shrink-0 mr-4 text-right select-none tabular-nums ${marked ? 'text-fg' : 'text-fg-faint'}`}
            >
              {number}
            </span>
            <span className="whitespace-pre text-fg-secondary pr-4">{content}</span>
          </div>
        )
      })}
      {(truncated || all.length > MAX_LINES) && (
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
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    window.crew
      .readFile(tab.path)
      .then(result => alive && setData(result ?? { kind: 'missing', path: tab.path }))
      .catch(() => alive && setData({ kind: 'missing', path: tab.path }))
    return () => {
      alive = false
    }
  }, [tab.path, tab.generation])

  useEffect(() => {
    if (!data) return
    if (data.kind === 'file' && tab.line) {
      bodyRef.current?.querySelector(`[data-line="${tab.line}"]`)?.scrollIntoView?.({ block: 'center' })
      return
    }
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [data, tab.line])

  return (
    <div
      ref={bodyRef}
      className="absolute inset-0 overflow-auto bg-ink-900"
      style={{ visibility: active ? 'visible' : 'hidden' }}
    >
      {!data && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size={20} className="text-fg-muted" />
        </div>
      )}
      {data?.kind === 'dir' && <DirRows tab={tab} path={data.path} entries={data.entries} />}
      {data?.kind === 'file' && <FileLines text={data.text} truncated={data.truncated} line={tab.line} />}
      {data?.kind === 'missing' && (
        <Empty
          icon={<DocumentIcon className="w-8 h-8 text-fg-faint" />}
          label="This file is not in the project"
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
  )
}
