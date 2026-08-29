import { useState, type ReactNode } from 'react'
import {
  ChevronUpGlyph,
  CloseGlyph,
  FileGlyph,
  FolderGlyph,
  MoreGlyph,
  PencilGlyph,
  RefreshGlyph,
  RegexGlyph
} from '../icons'
import { MenuDivider, MenuItem, Popover } from './Popover'
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

function TextMark({ children, underline }: { children: ReactNode; underline?: boolean }) {
  return <span className={`flex h-4 w-4 items-center justify-center text-[11px] font-medium ${underline ? 'underline underline-offset-2' : ''}`}>{children}</span>
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
  onReplaceAll,
  onNewFile,
  onNewFolder
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
  onNewFile?: () => void
  onNewFolder?: () => void
}) {
  const [menu, setMenu] = useState(false)

  return (
    <div className="shrink-0 border-b border-ink-700">
      <SearchField
        value={form.query}
        onChange={value => onChange('query', value)}
        placeholder="Search files"
        actions={
          <span className="relative flex shrink-0">
            {!form.query && onNewFile && (
              <Tool label="New file" onClick={onNewFile}>
                <FileGlyph className="h-4 w-4" />
              </Tool>
            )}
            {!form.query && onNewFolder && (
              <Tool label="New folder" onClick={onNewFolder}>
                <FolderGlyph className="h-4 w-4" />
              </Tool>
            )}
            <Tooltip label="More search options" disabled={menu}>
              <button
                type="button"
                aria-label="More search options"
                aria-expanded={menu}
                onClick={() => setMenu(open => !open)}
                className={`${tool} ${menu ? 'bg-fg/[0.1] text-fg' : ''}`}
              >
                <MoreGlyph className="h-4 w-4" />
              </button>
            </Tooltip>
            <Popover open={menu} onClose={() => setMenu(false)} className="min-w-56">
              <MenuItem
                icon={<PencilGlyph />}
                label="Replace"
                checked={replaceOpen}
                onClick={() => {
                  onReplaceOpen()
                  setMenu(false)
                }}
              />
              <MenuDivider />
              <MenuItem
                icon={<TextMark>Aa</TextMark>}
                label="Match case"
                checked={form.matchCase}
                onClick={() => onChange('matchCase', !form.matchCase)}
              />
              <MenuItem
                icon={<TextMark underline>ab</TextMark>}
                label="Match whole word"
                checked={form.wholeWord}
                onClick={() => onChange('wholeWord', !form.wholeWord)}
              />
              <MenuItem
                icon={<RegexGlyph />}
                label="Use regular expression"
                checked={form.regex}
                onClick={() => onChange('regex', !form.regex)}
              />
              {replaceOpen && (
                <MenuItem
                  icon={<TextMark>AB</TextMark>}
                  label="Preserve case"
                  checked={form.preserveCase}
                  onClick={() => onChange('preserveCase', !form.preserveCase)}
                />
              )}
              <MenuDivider />
              <MenuItem
                icon={<MoreGlyph />}
                label="File filters"
                checked={detailsOpen}
                onClick={() => {
                  onDetailsOpen()
                  setMenu(false)
                }}
              />
              {form.query.trim() && (
                <>
                  <MenuDivider />
                  <MenuItem
                    icon={<RefreshGlyph />}
                    label="Refresh search"
                    onClick={() => {
                      onRefresh()
                      setMenu(false)
                    }}
                  />
                  {resultCount > 0 && (
                    <MenuItem
                      icon={<ChevronUpGlyph />}
                      label={collapsed ? 'Show results' : 'Collapse results'}
                      onClick={() => {
                        onCollapse()
                        setMenu(false)
                      }}
                    />
                  )}
                  <MenuItem
                    icon={<CloseGlyph />}
                    label="Clear results"
                    onClick={() => {
                      onClearResults()
                      setMenu(false)
                    }}
                  />
                </>
              )}
            </Popover>
          </span>
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
            <Tool label="Replace all" onClick={onReplaceAll} disabled={!form.query.trim() || replaceCount === 0 || replacing}>
              <PencilGlyph className="h-3.5 w-3.5" />
            </Tool>
          }
        />
      )}
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
