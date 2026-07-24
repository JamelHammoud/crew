import { DocumentIcon, DocumentTextIcon, FolderIcon, PencilIcon } from '@heroicons/react/16/solid'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { FileEntry, RepoFile } from '../../../shared/files'
import { useBrowser, type BrowserTab } from '../state/browser'
import { useTheme } from '../state/theme'
import { highlightLines, type ThemedToken } from './highlight'
import Spinner from './Spinner'
import Tooltip from './Tooltip'

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

function FileLines({ path, text, truncated, line }: { path: string; text: string; truncated: boolean; line: number | null }) {
  const theme = useTheme()
  const all = text.split('\n')
  const lines = all.slice(0, MAX_LINES)
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null)
  const gutter = `${Math.max(String(lines.length).length, 2)}ch`

  useEffect(() => {
    let alive = true
    setTokens(null)
    void highlightLines(path, text.split('\n').slice(0, MAX_LINES).join('\n'), theme).then(
      result => alive && setTokens(result)
    )
    return () => {
      alive = false
    }
  }, [path, text, theme])

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
            <span className="whitespace-pre text-fg-secondary pr-4">
              <LineText content={content} tokens={tokens?.[index]} />
            </span>
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
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const draftRef = useRef('')
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    setEditing(false)
    setSaveFailed(false)
    window.crew
      .readFile(tab.path)
      .then(result => alive && setData(result ?? { kind: 'missing', path: tab.path }))
      .catch(() => alive && setData({ kind: 'missing', path: tab.path }))
    return () => {
      alive = false
    }
  }, [tab.path, tab.generation])

  useEffect(() => {
    if (!data || editing) return
    if (data.kind === 'file' && tab.line) {
      bodyRef.current?.querySelector(`[data-line="${tab.line}"]`)?.scrollIntoView?.({ block: 'center' })
      return
    }
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [data, tab.line, editing])

  const startEdit = () => {
    if (data?.kind !== 'file') return
    draftRef.current = data.text
    setSaveFailed(false)
    setEditing(true)
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    const fresh = await window.crew.writeFile(tab.path, draftRef.current).catch(() => null)
    setSaving(false)
    if (fresh?.kind === 'file') {
      setData(fresh)
      setEditing(false)
    } else {
      setSaveFailed(true)
    }
  }

  const onEditorKeys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault()
      void save()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setEditing(false)
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const target = event.currentTarget
      const { selectionStart, selectionEnd, value } = target
      target.value = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`
      target.setSelectionRange(selectionStart + 2, selectionStart + 2)
      draftRef.current = target.value
    }
  }

  const editable = data?.kind === 'file' && !data.truncated

  return (
    <div className="absolute inset-0 bg-ink-900" style={{ visibility: active ? 'visible' : 'hidden' }}>
      {editing && data?.kind === 'file' ? (
        <textarea
          defaultValue={data.text}
          onChange={event => {
            draftRef.current = event.target.value
          }}
          onKeyDown={onEditorKeys}
          aria-label="File contents"
          spellCheck={false}
          wrap="off"
          autoFocus
          className="absolute inset-0 w-full h-full resize-none bg-transparent px-4 py-3 font-mono text-xs leading-5 text-fg-secondary outline-none"
        />
      ) : (
        <div ref={bodyRef} className="absolute inset-0 overflow-auto">
          {!data && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size={20} className="text-fg-muted" />
            </div>
          )}
          {data?.kind === 'dir' && <DirRows tab={tab} path={data.path} entries={data.entries} />}
          {data?.kind === 'file' && (
            <FileLines path={tab.path} text={data.text} truncated={data.truncated} line={tab.line} />
          )}
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
      )}
      {editable && (
        <div className="absolute top-2.5 right-4 flex items-center gap-1.5">
          {editing ? (
            <>
              {saveFailed && <span className="text-xs text-danger mr-1">Could not save</span>}
              <button
                onClick={() => setEditing(false)}
                className="glass h-8 px-3.5 rounded-full text-sm text-fg-secondary transition-all duration-150 hover:text-fg active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => void save()}
                disabled={saving}
                className="h-8 px-3.5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-1.5 transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100"
              >
                {saving && <Spinner size={12} className="text-ink-900" />}
                Save
              </button>
            </>
          ) : (
            <Tooltip label="Edit file">
              <button
                onClick={startEdit}
                aria-label="Edit file"
                className="glass w-8 h-8 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg active:scale-95"
              >
                <PencilIcon className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )
}
