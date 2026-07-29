import { useState, type ReactNode } from 'react'
import type { FileChange } from '../../../shared/llm'
import { ChevronRightGlyph } from '../icons'
import { useBrowser } from '../state/browser'
import Counts from './Counts'
import { carries, stepHidden, useFindQuery } from './find'
import {
  FileTextLink,
  isPrivate,
  labelFor,
  openable,
  parseFileRef,
  PrivateChip,
  targetFor,
  TextWithFileLinks,
  useLocated
} from './fileLinks'
import Markdown from './Markdown'
import StepCode from './StepCode'
import StepDiff from './StepDiff'
import type { ThreadItem } from './thread'
import ThinkingMark from './ThinkingMark'
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
    <ChevronRightGlyph
      className={`w-3.5 h-3.5 shrink-0 text-fg-faint transition-all duration-200 ${
        open ? 'rotate-90 opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
    />
  )
}

const SUBJECT = 'truncate text-xs text-fg-faint'
export const SUBJECT_MONO = `${SUBJECT} mono-inline`

export const rowClass = (expandable: boolean): string =>
  `group flex items-center gap-2.5 max-w-full text-sm text-left -ml-2 pl-2 pr-3 py-1 rounded-full transition-colors ${
    expandable ? 'hover:bg-ink-hover' : 'cursor-default'
  }`

export function Label({ action, running, swap }: { action: ToolAction; running: boolean; swap?: boolean }) {
  const word = running ? action.run : action.done
  return (
    <span
      className={`shrink-0 transition-colors ${
        running ? 'text-fg-secondary' : 'text-fg-muted group-hover:text-fg-secondary'
      }`}
    >
      {swap ? (
        <span key={word} className="word-swap inline-block">
          {word}
        </span>
      ) : (
        word
      )}
    </span>
  )
}

function Detail({ children }: { children: ReactNode }) {
  return <div className="mt-2 space-y-2">{children}</div>
}

// A row that already shows everything it has is not worth a chevron. A path or
// a link opens where it points instead, and only what a row cannot hold opens
// underneath it.
const ROW_ROOM = 90

const crowded = (detail: string): boolean => detail.length > ROW_ROOM || detail.includes('\n')

const linkIn = (detail: string): string | null => {
  const one = detail.trim()
  return /^https?:\/\/\S+$/.test(one) ? one : null
}

function useOpener(detail: string, files: FileChange[]): (() => void) | null {
  const url = files.length > 0 ? null : linkIn(detail)
  const ref = files.length > 0 || url ? null : parseFileRef(detail)
  useLocated(ref ? [ref.path] : [])
  if (url) return () => useBrowser.getState().openUrl(url)
  if (ref && openable(ref.path)) return () => useBrowser.getState().openFile(targetFor(ref.path), ref.line)
  return null
}

// A blank line between thoughts is a paragraph, not an empty row of its own.

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
  const expandable =
    thinking || files.length > 0 || (!opens && Boolean(detail) && (!action.prose || crowded(detail)))
  const query = useFindQuery()
  const found = expandable && carries(query, stepHidden(item))
  const expanded = open ?? (found || (thinking ? item.streaming : false))
  const subject = files.length === 0 && item.detail && !expanded ? item.detail : ''

  return (
    <div className={`animate-rise ${inGroup ? '' : 'pl-14'} ${linked ? '-mt-3' : ''}`}>
      <button
        onClick={() => (opens ? opens() : expandable && setOpen(!expanded))}
        className={rowClass(Boolean(opens) || expandable)}
      >
        {thinking ? (
          <ThinkingMark running={item.streaming} />
        ) : (
          <Mark icon={action.icon} running={item.streaming} />
        )}
        <Label action={action} running={item.streaming} swap={thinking} />
        {files.length > 0 && (
          <>
            {files.length === 1 ? (
              <FilePathLink
                path={files[0].path}
                diff={files[0].diff}
                className={SUBJECT_MONO}
                again={!item.streaming}
              />
            ) : (
              <span className={SUBJECT_MONO}>{`${files.length} files`}</span>
            )}
            <Counts added={totals.added} removed={totals.removed} className="mono-inline" />
          </>
        )}
        {subject && (
          <span className={action.prose ? SUBJECT : SUBJECT_MONO}>
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
      {expanded && files.length === 0 && (thinking || detail) && (
        <Detail>
          {thinking ? (
            <div onClick={() => setOpen(false)} className="cursor-pointer">
              <Markdown text={item.text} className="md-quiet" stream={item.streaming} />
            </div>
          ) : action.prose ? (
            <p
              onClick={() => setOpen(false)}
              className="whitespace-pre-wrap cursor-pointer text-fg-muted text-xs leading-5"
            >
              <TextWithFileLinks text={detail} inline again={!item.streaming} />
            </p>
          ) : (
            <StepCode text={detail} prompt={action.terminal} output={action.terminal ? item.output : undefined} />
          )}
        </Detail>
      )}
    </div>
  )
}
