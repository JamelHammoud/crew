import { ChevronRightIcon } from '@heroicons/react/16/solid'
import { useState, type ReactNode } from 'react'
import type { FileChange } from '../../../shared/llm'
import { FileTextLink, isPrivate, labelFor, PrivateChip, TextWithFileLinks, useLocated } from './fileLinks'
import Spinner from './Spinner'
import type { ThreadItem } from './thread'
import { THINKING, toolAction, type ToolIcon } from './toolActions'

export function FilePathLink({
  path,
  diff,
  className,
  again
}: {
  path: string
  diff?: string | null
  className?: string
  again?: unknown
}) {
  useLocated([path], again)
  if (isPrivate(path)) return <PrivateChip />
  return (
    <FileTextLink path={path} diff={diff} className={className}>
      {labelFor(path, '', path)}
    </FileTextLink>
  )
}

function Mark({ icon: Icon, running }: { icon: ToolIcon; running: boolean }) {
  return (
    <Icon
      className={`w-4 h-4 shrink-0 transition-colors ${
        running ? 'text-fg pulse-soft' : 'text-fg-muted group-hover:text-fg-secondary'
      }`}
    />
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRightIcon
      className={`w-3.5 h-3.5 shrink-0 text-fg-faint transition-all duration-200 ${
        open ? 'rotate-90 opacity-100' : 'opacity-0 group-hover:opacity-100'
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

function Detail({ children }: { children: ReactNode }) {
  return <div className="mt-2 ml-[11px] border-l border-ink-700 pl-4">{children}</div>
}

function FileRows({ files, done }: { files: FileChange[]; done: boolean }) {
  return (
    <Detail>
      <div className="space-y-3">
        {files.map(file => (
          <div key={file.path}>
            <span className="flex items-center gap-2 text-xs font-mono">
              <FilePathLink path={file.path} diff={file.diff} className="text-fg-secondary truncate" again={done} />
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
    </Detail>
  )
}

export default function StepRow({ item, linked }: { item: ThreadItem; linked?: boolean }) {
  const [open, setOpen] = useState<boolean | null>(null)
  const thinking = item.kind === 'thinking'
  const action = thinking ? THINKING : toolAction(item.name, item.subagent)
  const files = item.files ?? []
  const totals = files.reduce(
    (acc, file) => ({ added: acc.added + file.added, removed: acc.removed + file.removed }),
    { added: 0, removed: 0 }
  )
  const expandable = thinking || files.length > 0 || Boolean(item.detail)
  const expanded = open ?? (thinking ? item.streaming : false)
  const subject = files.length === 0 && item.detail && !expanded ? item.detail : ''

  return (
    <div className={`pl-14 animate-rise ${linked ? '-mt-3' : ''}`}>
      <button
        onClick={() => expandable && setOpen(!expanded)}
        className={`group flex items-center gap-2.5 max-w-full text-sm text-left -ml-2 pl-2 pr-3 py-1 rounded-full transition-colors ${
          expandable ? 'hover:bg-ink-hover' : 'cursor-default'
        }`}
      >
        <Chip icon={action.icon} running={item.streaming} />
        <span
          className={`shrink-0 transition-colors ${
            item.streaming ? 'text-fg-secondary' : 'text-fg-muted group-hover:text-fg-secondary'
          }`}
        >
          {item.streaming ? action.run : action.done}
        </span>
        {files.length > 0 && (
          <>
            {files.length === 1 ? (
              <FilePathLink
                path={files[0].path}
                diff={files[0].diff}
                className="text-fg-faint truncate font-mono text-xs"
                again={!item.streaming}
              />
            ) : (
              <span className="text-fg-faint truncate font-mono text-xs">{`${files.length} files`}</span>
            )}
            <Counts added={totals.added} removed={totals.removed} />
          </>
        )}
        {subject && (
          <span className={`text-fg-faint truncate ${action.prose ? 'text-xs' : 'font-mono text-xs'}`}>
            <TextWithFileLinks text={subject} inline again={!item.streaming} />
          </span>
        )}
        {expandable && <Chevron open={expanded} />}
      </button>
      {expanded && files.length > 0 && <FileRows files={files} done={!item.streaming} />}
      {expanded && files.length === 0 && (thinking ? item.text.trim() : item.detail) && (
        <Detail>
          <p
            onClick={() => setOpen(false)}
            className={`whitespace-pre-wrap cursor-pointer ${
              thinking ? 'text-sm text-fg-muted leading-6' : 'text-xs font-mono text-fg-muted leading-5 break-all'
            }`}
          >
            <TextWithFileLinks text={thinking ? item.text.trim() : (item.detail ?? '')} inline again={!item.streaming} />
          </p>
        </Detail>
      )}
    </div>
  )
}
