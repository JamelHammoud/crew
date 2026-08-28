import type { ReactNode } from 'react'
import { ChevronRightGlyph, ChevronUpGlyph, CloseGlyph, MoreGlyph, PencilGlyph, RefreshGlyph } from '../icons'
import SearchField from './SearchField'
import Tooltip from './Tooltip'

export interface FileSearchForm {
  query: string
  replacement: string
  matchCase: boolean
  wholeWord: boolean
  regex: boolean
  preserveCase: boolean
  include: string
  exclude: string
}

const tool =
  'h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-fg/45 transition-colors hover:bg-fg/[0.08] hover:text-fg active:scale-90 disabled:opacity-30 disabled:pointer-events-none'

function Tool({
  label,
  pressed,
  disabled,
  onClick,
  children
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
        className={`${tool} ${pressed ? 'bg-fg/[0.1] text-fg' : ''}`}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function TextTool({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tool label={label} pressed={pressed} onClick={onClick}>
      <span className="text-xs leading-none font-medium">{children}</span>
    </Tool>
  )
}

export default function FileSearchControls({
  form,
  replaceOpen,
  detailsOpen,
  resultCount,
  replaceCount,
  collapsed,
  replacing,
  onChange,
  onReplaceOpen,
  onDetailsOpen,
  onRefresh,
  onClearResults,
  onCollapse,
  onReplaceAll
}: {
  form: FileSearchForm
  replaceOpen: boolean
  detailsOpen: boolean
  resultCount: number
  replaceCount: number
  collapsed: boolean
  replacing: boolean
  onChange: <K extends keyof FileSearchForm>(key: K, value: FileSearchForm[K]) => void
  onReplaceOpen: () => void
  onDetailsOpen: () => void
  onRefresh: () => void
  onClearResults: () => void
  onCollapse: () => void
  onReplaceAll: () => void
}) {
  return (
    <div className="shrink-0 border-b border-ink-700">
      <div className="h-10 px-3 flex items-center gap-1">
        <h2 className="mr-auto text-[11px] font-medium uppercase tracking-wide text-fg-secondary">Search</h2>
        <Tool label="Refresh search" onClick={onRefresh} disabled={!form.query.trim()}>
          <RefreshGlyph className="h-4 w-4" />
        </Tool>
        <Tool label={collapsed ? 'Show results' : 'Collapse results'} onClick={onCollapse} disabled={resultCount === 0} pressed={collapsed}>
          <ChevronUpGlyph className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </Tool>
        <Tool label="Clear results" onClick={onClearResults} disabled={!form.query.trim()}>
          <CloseGlyph className="h-3.5 w-3.5" />
        </Tool>
      </div>
      <SearchField
        value={form.query}
        onChange={value => onChange('query', value)}
        placeholder="Search files"
        prefix={
          <Tool label={replaceOpen ? 'Hide replace' : 'Show replace'} pressed={replaceOpen} onClick={onReplaceOpen}>
            <ChevronRightGlyph className={`h-3.5 w-3.5 transition-transform ${replaceOpen ? 'rotate-90' : ''}`} />
          </Tool>
        }
        actions={
          <>
            <TextTool label="Match case" pressed={form.matchCase} onClick={() => onChange('matchCase', !form.matchCase)}>
              Aa
            </TextTool>
            <TextTool label="Match whole word" pressed={form.wholeWord} onClick={() => onChange('wholeWord', !form.wholeWord)}>
              <span className="underline underline-offset-2">ab</span>
            </TextTool>
            <TextTool label="Use regular expression" pressed={form.regex} onClick={() => onChange('regex', !form.regex)}>
              .*
            </TextTool>
          </>
        }
      />
      {replaceOpen && (
        <SearchField
          value={form.replacement}
          onChange={value => onChange('replacement', value)}
          placeholder="Replace"
          search={false}
          autoFocus={false}
          clearLabel="Clear replacement"
          actions={
            <>
              <TextTool label="Preserve case" pressed={form.preserveCase} onClick={() => onChange('preserveCase', !form.preserveCase)}>
                AB
              </TextTool>
              <Tool label="Replace all" onClick={onReplaceAll} disabled={!form.query.trim() || replaceCount === 0 || replacing}>
                <PencilGlyph className="h-3.5 w-3.5" />
              </Tool>
            </>
          }
        />
      )}
      <div className="flex h-9 items-center px-3">
        <button
          type="button"
          onClick={onDetailsOpen}
          aria-expanded={detailsOpen}
          className="flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg active:scale-[0.98]"
        >
          <MoreGlyph className="h-4 w-4" />
          {detailsOpen ? 'Fewer filters' : 'More filters'}
        </button>
        {resultCount > 0 && <span className="ml-auto text-xs tabular-nums text-fg-faint">{resultCount}</span>}
      </div>
      {detailsOpen && (
        <div className="border-t border-fg/[0.06]">
          <SearchField
            value={form.include}
            onChange={value => onChange('include', value)}
            placeholder="Files to include"
            search={false}
            autoFocus={false}
            clearLabel="Clear included files"
          />
          <SearchField
            value={form.exclude}
            onChange={value => onChange('exclude', value)}
            placeholder="Files to exclude"
            search={false}
            autoFocus={false}
            clearLabel="Clear excluded files"
          />
        </div>
      )}
    </div>
  )
}
