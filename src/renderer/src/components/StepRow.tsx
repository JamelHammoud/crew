import { ChevronRightIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import type { FileChange } from '../../../shared/llm'
import Spinner from './Spinner'
import type { ThreadItem } from './thread'

function Marker({ running }: { running: boolean }) {
  if (running) return <Spinner size={12} className="text-fg-secondary" />
  return <span className="w-1.5 h-1.5 mx-[3px] rounded-full bg-ink-500 shrink-0" />
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRightIcon
      className={`w-3.5 h-3.5 shrink-0 text-fg-faint group-hover:text-fg-muted transition-transform duration-200 ${
        open ? 'rotate-90' : ''
      }`}
    />
  )
}

export function Counts({ added, removed, size = 'xs' }: { added: number; removed: number; size?: 'xs' | 'sm' }) {
  if (!added && !removed) return null
  return (
    <span className={`shrink-0 font-mono ${size === 'sm' ? 'text-sm' : 'text-xs'}`}>
      {added > 0 && <span className="text-positive">+{added}</span>}
      {added > 0 && removed > 0 && ' '}
      {removed > 0 && <span className="text-danger">−{removed}</span>}
    </span>
  )
}

function Diff({ diff }: { diff: string }) {
  return (
    <p className="text-xs font-mono leading-5 whitespace-pre-wrap break-all">
      {diff.split('\n').map((line, index) => (
        <span
          key={index}
          className={`block ${
            line.startsWith('+') ? 'text-positive' : line.startsWith('-') ? 'text-danger' : 'text-fg-muted'
          }`}
        >
          {line}
        </span>
      ))}
    </p>
  )
}

function FileRows({ files }: { files: FileChange[] }) {
  return (
    <div className="mt-2 ml-[5px] border-l border-ink-700 pl-4 space-y-3">
      {files.map(file => (
        <div key={file.path}>
          <span className="flex items-center gap-2 text-xs font-mono">
            <span className="text-fg-secondary truncate">{file.path}</span>
            <Counts added={file.added} removed={file.removed} />
          </span>
          {file.diff && (
            <div className="mt-1.5">
              <Diff diff={file.diff} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function StepRow({ item }: { item: ThreadItem }) {
  const [open, setOpen] = useState<boolean | null>(null)

  if (item.kind === 'tool') {
    const files = item.files ?? []
    const totals = files.reduce(
      (acc, file) => ({ added: acc.added + file.added, removed: acc.removed + file.removed }),
      { added: 0, removed: 0 }
    )
    const expanded = open ?? false
    const expandable = files.length > 0 || Boolean(item.detail)
    return (
      <div className="pl-14 animate-rise">
        <button
          onClick={() => expandable && setOpen(!expanded)}
          className={`group flex items-center gap-2.5 text-sm w-full text-left ${
            expandable ? '' : 'cursor-default'
          }`}
        >
          <Marker running={item.streaming} />
          <span className={`shrink-0 ${item.streaming ? 'text-fg-secondary' : 'text-fg-muted'}`}>
            {item.subagent ? `${item.name} (agent)` : item.name}
          </span>
          {files.length > 0 ? (
            <>
              <span className="text-fg-faint truncate font-mono text-xs">
                {files.length === 1 ? files[0].path : `${files.length} files`}
              </span>
              <Counts added={totals.added} removed={totals.removed} />
            </>
          ) : (
            item.detail && !expanded && <span className="text-fg-faint truncate font-mono text-xs">{item.detail}</span>
          )}
        </button>
        {expanded &&
          (files.length > 0 ? (
            <FileRows files={files} />
          ) : (
            item.detail && (
              <p
                onClick={() => setOpen(false)}
                className="text-xs font-mono text-fg-muted leading-5 mt-2 ml-[5px] whitespace-pre-wrap break-all border-l border-ink-700 pl-4 cursor-pointer"
              >
                {item.detail}
              </p>
            )
          ))}
      </div>
    )
  }

  const expanded = open ?? item.streaming
  return (
    <div className="pl-14 animate-rise">
      <button
        onClick={() => setOpen(!expanded)}
        className="group flex items-center gap-2.5 text-sm text-fg-muted hover:text-fg-secondary transition-colors"
      >
        <Marker running={item.streaming} />
        <span>Thinking</span>
        <Chevron open={expanded} />
      </button>
      {expanded && (
        <p className="text-sm text-fg-muted leading-6 mt-2 ml-[5px] whitespace-pre-wrap border-l border-ink-700 pl-4">
          {item.text.trim()}
        </p>
      )}
    </div>
  )
}
