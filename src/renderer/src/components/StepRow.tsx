import { ChevronRightIcon } from '@heroicons/react/16/solid'
import { useState, type ReactNode } from 'react'
import type { FileChange } from '../../../shared/llm'
import Counts from './Counts'
import { FileTextLink, isPrivate, labelFor, PrivateChip, TextWithFileLinks, useLocated } from './fileLinks'
import StepDiff from './StepDiff'
import type { ThreadItem } from './thread'
import { THINKING, toolAction, type ToolAction, type ToolIcon } from './toolActions'

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

export function Mark({ icon: Icon, running }: { icon: ToolIcon; running: boolean }) {
  return (
    <Icon
      className={`w-[18px] h-[18px] shrink-0 transition-colors ${
        running ? 'text-fg pulse-soft' : 'text-fg-muted group-hover:text-fg-secondary'
      }`}
    />
  )
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRightIcon
      className={`w-3.5 h-3.5 shrink-0 text-fg-faint transition-all duration-200 ${
        open ? 'rotate-90 opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
    />
  )
}

export const rowClass = (expandable: boolean): string =>
  `group flex items-center gap-2.5 max-w-full text-sm text-left -ml-2 pl-2 pr-3 py-1 rounded-full transition-colors ${
    expandable ? 'hover:bg-ink-hover' : 'cursor-default'
  }`

export function Label({ action, running }: { action: ToolAction; running: boolean }) {
  return (
    <span
      className={`shrink-0 transition-colors ${
        running ? 'text-fg-secondary' : 'text-fg-muted group-hover:text-fg-secondary'
      }`}
    >
      {running ? action.run : action.done}
    </span>
  )
}

function Detail({ children }: { children: ReactNode }) {
  return <div className="mt-1.5 mb-1 space-y-2">{children}</div>
}

export const stepFiles = (item: ThreadItem): FileChange[] => item.files ?? []

export const stepTotals = (files: FileChange[]): { added: number; removed: number } =>
  files.reduce((acc, file) => ({ added: acc.added + file.added, removed: acc.removed + file.removed }), {
    added: 0,
    removed: 0
  })

export default function StepRow({ item, linked, inGroup }: { item: ThreadItem; linked?: boolean; inGroup?: boolean }) {
  const [open, setOpen] = useState<boolean | null>(null)
  const thinking = item.kind === 'thinking'
  const action = thinking ? THINKING : toolAction(item.name, item.subagent)
  const files = stepFiles(item)
  const totals = stepTotals(files)
  const detail = thinking ? '' : (item.detail ?? '')
  const opens = useOpener(detail, files)
  const expandable = thinking || files.length > 1 || files.some(file => file.diff) || (!opens && crowded(detail))
  const expanded = open ?? (thinking ? item.streaming : false)
  const subject = files.length === 0 && item.detail && !expanded ? item.detail : ''

  return (
    <div className={`animate-rise ${inGroup ? '' : 'pl-14'} ${linked ? '-mt-3' : ''}`}>
      <button
        onClick={() => (opens ? opens() : expandable && setOpen(!expanded))}
        className={rowClass(Boolean(opens) || expandable)}
      >
        <Mark icon={action.icon} running={item.streaming} />
        <Label action={action} running={item.streaming} />
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
          <span className={`text-fg-faint truncate text-xs ${action.prose ? '' : 'font-mono'}`}>
            <TextWithFileLinks text={subject} inline again={!item.streaming} />
          </span>
        )}
        {expandable && <Chevron open={expanded} />}
      </button>
      {expanded && files.length > 0 && (
        <Detail>
          {files.map(file => (
            <StepDiff key={file.path} file={file} again={!item.streaming} />
          ))}
        </Detail>
      )}
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
