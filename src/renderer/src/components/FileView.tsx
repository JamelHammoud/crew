import { DocumentIcon, DocumentTextIcon, FolderIcon } from '@heroicons/react/16/solid'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { FileEntry, RepoFile } from '../../../shared/files'
import { useBrowser, type BrowserTab } from '../state/browser'
import { useTheme } from '../state/theme'
import { highlightLines, type ThemedToken } from './highlight'
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

function CodeBody({
  tab,
  text,
  editable,
  truncated,
  dirty,
  onChange,
  onKeys
}: {
  tab: BrowserTab
  text: string
  editable: boolean
  truncated: boolean
  dirty: boolean
  onChange: (next: string, caretLine: number) => void
  onKeys: (event: KeyboardEvent<HTMLTextAreaElement>) => void
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
    <div className="relative min-h-full py-3 min-w-max font-mono text-xs leading-5">
      <div aria-hidden={editable || undefined}>
        {lines.map((content, index) => {
          const number = index + 1
          const marked = tab.line === number
          return (
            <div key={number} data-line={number} className={`flex px-4 ${marked ? 'bg-fg/[0.07]' : ''}`}>
              <span
                style={{ minWidth: gutter }}
                className={`shrink-0 mr-4 text-right select-none tabular-nums ${marked ? 'text-fg' : 'text-fg-faint'}`}
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
          )
        })}
      </div>
      {editable && (
        <textarea
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
  const bodyRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!data) return
    if (data.kind === 'file' && tab.line) {
      bodyRef.current?.querySelector(`[data-line="${tab.line}"]`)?.scrollIntoView?.({ block: 'center' })
      return
    }
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [loadKey, tab.line])

  const file = data?.kind === 'file' ? data : null
  const editable = !!file && !file.truncated && file.text.split('\n').length <= MAX_LINES
  const dirty = editable && !!file && draft !== file.text

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
            editable={editable}
            truncated={file.truncated}
            dirty={dirty}
            onChange={onEdit}
            onKeys={onEditorKeys}
          />
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
