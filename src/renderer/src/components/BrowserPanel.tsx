import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/16/solid'
import { useEffect, useState, type KeyboardEvent } from 'react'
import { useBrowser, type BrowserTab } from '../state/browser'
import BrowserTabView, { viewFor } from './BrowserTabView'
import FileView, { FileCrumbs } from './FileView'
import Spinner from './Spinner'
import Tooltip from './Tooltip'

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/\s/.test(trimmed) || !trimmed.includes('.')) {
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
  }
  return `https://${trimmed}`
}

function tabLabel(tab: BrowserTab): string {
  if (tab.kind === 'file') return tab.path.split('/').pop() || 'Files'
  if (tab.title) return tab.title
  if (!tab.url) return 'New tab'
  try {
    return new URL(tab.url).hostname
  } catch {
    return tab.url
  }
}

const iconButton =
  'w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95 disabled:opacity-30 disabled:pointer-events-none'

export default function BrowserPanel() {
  const tabs = useBrowser(s => s.tabs)
  const activeTabId = useBrowser(s => s.activeTabId)
  const active = tabs.find(t => t.id === activeTabId) ?? null

  return (
    <div className="h-full flex flex-col">
      <header className="app-drag h-[70px] px-4 flex items-center gap-1.5 shrink-0">
        <div className="app-no-drag flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {tabs.map(tab => (
            <TabPill key={tab.id} tab={tab} active={tab.id === activeTabId} />
          ))}
        </div>
        <Tooltip label="New tab">
          <button onClick={() => useBrowser.getState().addTab()} aria-label="New tab" className={`app-no-drag ${iconButton}`}>
            <PlusIcon className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip label="Close">
          <button
            onClick={() => useBrowser.getState().closeAll()}
            aria-label="Close"
            className={`app-no-drag ${iconButton}`}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </Tooltip>
      </header>

      {active && active.kind === 'file' && (
        <div className="app-no-drag px-4 pb-3 flex items-center gap-1 shrink-0">
          <button
            onClick={() => useBrowser.getState().fileBack(active.id)}
            disabled={active.back.length === 0}
            aria-label="Back"
            className={iconButton}
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => useBrowser.getState().fileForward(active.id)}
            disabled={active.forward.length === 0}
            aria-label="Forward"
            className={iconButton}
          >
            <ArrowRightIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => useBrowser.getState().reloadFile(active.id)}
            aria-label="Reload"
            className={iconButton}
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
          <FileCrumbs tab={active} />
          <Tooltip label="Show in folder">
            <button
              onClick={() => void window.crew.revealFile(active.path)}
              aria-label="Show in folder"
              className={iconButton}
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      )}

      {active && active.kind === 'web' && (
        <div className="app-no-drag px-4 pb-3 flex items-center gap-1 shrink-0">
          <button
            onClick={() => viewFor(active.id)?.goBack()}
            disabled={!active.canGoBack}
            aria-label="Back"
            className={iconButton}
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => viewFor(active.id)?.goForward()}
            disabled={!active.canGoForward}
            aria-label="Forward"
            className={iconButton}
          >
            <ArrowRightIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => (active.loading ? viewFor(active.id)?.stop() : viewFor(active.id)?.reload())}
            disabled={!active.initialUrl}
            aria-label={active.loading ? 'Stop' : 'Reload'}
            className={iconButton}
          >
            {active.loading ? <XMarkIcon className="w-4 h-4" /> : <ArrowPathIcon className="w-4 h-4" />}
          </button>
          <UrlBar key={active.id} tab={active} />
          <Tooltip label="Open in your browser">
            <button
              onClick={() => void window.crew.openExternal(active.url)}
              disabled={!active.url}
              aria-label="Open in your browser"
              className={iconButton}
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      )}

      <div className="app-no-drag flex-1 min-h-0 relative border-t border-ink-700">
        {tabs
          .filter(tab => tab.initialUrl)
          .map(tab => (
            <BrowserTabView key={tab.id} tab={tab} active={tab.id === activeTabId} />
          ))}
        {active && !active.initialUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <GlobeAltIcon className="w-8 h-8 text-fg-faint" />
            <p className="text-sm text-fg-muted">Search or enter a web address above</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TabPill({ tab, active }: { tab: BrowserTab; active: boolean }) {
  return (
    <button
      onClick={() => useBrowser.getState().selectTab(tab.id)}
      className={`group flex items-center gap-1.5 h-9 pl-3 pr-1.5 rounded-full text-sm font-medium max-w-[180px] shrink-0 transition-all duration-150 active:scale-95 ${
        active ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
      }`}
    >
      {tab.loading ? (
        <Spinner size={14} className="text-fg-muted" />
      ) : tab.favicon ? (
        <img src={tab.favicon} alt="" className="w-4 h-4 shrink-0 rounded-sm" />
      ) : (
        <GlobeAltIcon className="w-4 h-4 shrink-0" />
      )}
      <span className="truncate">{tabLabel(tab)}</span>
      <span
        onClick={event => {
          event.stopPropagation()
          useBrowser.getState().closeTab(tab.id)
        }}
        aria-label="Close tab"
        className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-fg/10"
      >
        <XMarkIcon className="w-3 h-3" />
      </span>
    </button>
  )
}

function UrlBar({ tab }: { tab: BrowserTab }) {
  const [value, setValue] = useState(tab.url)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setValue(tab.url)
  }, [tab.url, focused])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !value.trim()) return
    const url = normalizeUrl(value)
    const view = viewFor(tab.id)
    if (view) {
      view.loadURL(url).catch(() => undefined)
    } else {
      useBrowser.getState().navigateTab(tab.id, url)
    }
    event.currentTarget.blur()
  }

  return (
    <input
      value={value}
      autoFocus={!tab.initialUrl}
      onChange={event => setValue(event.target.value)}
      onFocus={event => {
        setFocused(true)
        event.target.select()
      }}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      placeholder="Search or enter a web address"
      spellCheck={false}
      className="flex-1 min-w-0 h-9 mx-1 px-3.5 rounded-full bg-fg/[0.06] text-sm text-fg-secondary focus:text-fg placeholder:text-fg-faint outline-none transition-colors focus:bg-fg/[0.08]"
    />
  )
}
