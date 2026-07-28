import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { isImageUrl } from '../../../shared/files'
import { gameFor } from '../../../shared/games'
import { normalizeUrl } from '../../../shared/urls'
import {
  ArrowLeftGlyph,
  ArrowRightGlyph,
  ChecklistGlyph,
  CloseGlyph,
  DocGlyph,
  ExternalLinkGlyph,
  FolderGlyph,
  GameGlyph,
  GlobeGlyph,
  MusicGlyph,
  PhotoGlyph,
  PlusGlyph,
  RefreshGlyph,
  TerminalGlyph,
  XCircleGlyph
} from '../icons'
import { useBrowser, type BrowserTab } from '../state/browser'
import { useCrew } from '../state/store'
import BrowserTabView, { viewFor } from './BrowserTabView'
import FileView, { FileCrumbs } from './FileView'
import GameView from './game/GameView'
import ImageView from './ImageView'
import MusicView from './music/MusicView'
import PlanView from './PlanView'
import { MenuItem, Popover } from './Popover'
import Spinner from './Spinner'
import TerminalView from './TerminalView'
import Tooltip from './Tooltip'

export const showsImage = (tab: BrowserTab): boolean =>
  tab.kind === 'image' || (tab.kind === 'web' && isImageUrl(tab.initialUrl))

const imageName = (url: string): string => (url.split(/[?#]/)[0] ?? '').split('/').pop() || 'Image'

function tabLabel(tab: BrowserTab): string {
  if (tab.kind === 'plan') return 'Plan'
  if (tab.kind === 'music') return 'Music'
  // A games tab says which game you are in, and keeps the same mark whichever
  // one that is. Out of a game it is the tab's own name again.
  if (tab.kind === 'game') return gameFor(tab.game ?? '')?.name ?? 'Games'
  if (tab.kind === 'terminal') return tab.title || 'Terminal'
  if (tab.kind === 'file') return tab.path.split('/').pop() || 'Files'
  if (showsImage(tab)) return tab.title || imageName(tab.initialUrl)
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
  const [newOpen, setNewOpen] = useState(false)
  // The plan comes with the thread you are in and goes when you leave it.
  const planThread = useCrew(s => (s.openThreadId && s.threads[s.openThreadId]?.plan ? s.openThreadId : null))

  useEffect(() => {
    if (planThread) useBrowser.getState().showPlan(planThread)
    else useBrowser.getState().hidePlan()
  }, [planThread])

  const reload = (tab: BrowserTab) => {
    if (showsImage(tab)) {
      useBrowser.getState().reloadTab(tab.id)
      return
    }
    const view = viewFor(tab.id)
    if (tab.loading) view?.stop()
    else view?.reload()
  }

  return (
    <div className="h-full flex flex-col">
      <header className="app-drag h-[70px] px-4 flex items-center gap-1.5 shrink-0">
        <div className="app-no-drag flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {tabs.map(tab => (
            <TabPill key={tab.id} tab={tab} active={tab.id === activeTabId} />
          ))}
        </div>
        <span className="app-no-drag shrink-0 flex">
          <Tooltip label="New tab" disabled={newOpen}>
            <button
              onClick={() => setNewOpen(true)}
              aria-label="New tab"
              className={`${iconButton} ${newOpen ? 'text-fg bg-fg/[0.06]' : ''}`}
            >
              <PlusGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
          <Popover open={newOpen} onClose={() => setNewOpen(false)}>
            <MenuItem
              icon={<GlobeGlyph />}
              label="Web page"
              onClick={() => {
                setNewOpen(false)
                useBrowser.getState().addTab()
              }}
            />
            <MenuItem
              icon={<TerminalGlyph />}
              label="Terminal"
              onClick={() => {
                setNewOpen(false)
                useBrowser.getState().addTerminal()
              }}
            />
            <MenuItem
              icon={<FolderGlyph />}
              label="Files"
              onClick={() => {
                setNewOpen(false)
                useBrowser.getState().openFiles()
              }}
            />
            <MenuItem
              icon={<MusicGlyph />}
              label="Music"
              onClick={() => {
                setNewOpen(false)
                useBrowser.getState().openMusic()
              }}
            />
            <MenuItem
              icon={<GameGlyph />}
              label="Games"
              onClick={() => {
                setNewOpen(false)
                useBrowser.getState().openGame()
              }}
            />
          </Popover>
        </span>
        {tabs.some(tab => tab.kind !== 'plan') && (
          <Tooltip label="Close">
            <button
              onClick={() => useBrowser.getState().closeAll()}
              aria-label="Close"
              className={`app-no-drag ${iconButton}`}
            >
              <CloseGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
      </header>

      {active && active.kind === 'file' && (
        <div className="app-no-drag px-4 pb-3 flex items-center gap-1 shrink-0">
          <button
            onClick={() => useBrowser.getState().fileBack(active.id)}
            disabled={active.back.length === 0}
            aria-label="Back"
            className={iconButton}
          >
            <ArrowLeftGlyph className="w-4 h-4" />
          </button>
          <button
            onClick={() => useBrowser.getState().fileForward(active.id)}
            disabled={active.forward.length === 0}
            aria-label="Forward"
            className={iconButton}
          >
            <ArrowRightGlyph className="w-4 h-4" />
          </button>
          <button
            onClick={() => useBrowser.getState().reloadTab(active.id)}
            aria-label="Reload"
            className={iconButton}
          >
            <RefreshGlyph className="w-4 h-4" />
          </button>
          <FileCrumbs tab={active} />
          <Tooltip label={active.tree ? 'Hide files' : 'Show files'}>
            <button
              onClick={() => useBrowser.getState().toggleTree(active.id)}
              aria-label={active.tree ? 'Hide files' : 'Show files'}
              aria-pressed={active.tree}
              className={`${iconButton} ${active.tree ? 'text-fg bg-fg/[0.06]' : ''}`}
            >
              <FolderGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip label="Show in folder">
            <button
              onClick={() => void window.crew.revealFile(active.path)}
              aria-label="Show in folder"
              className={iconButton}
            >
              <ExternalLinkGlyph className="w-4 h-4" />
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
            <ArrowLeftGlyph className="w-4 h-4" />
          </button>
          <button
            onClick={() => viewFor(active.id)?.goForward()}
            disabled={!active.canGoForward}
            aria-label="Forward"
            className={iconButton}
          >
            <ArrowRightGlyph className="w-4 h-4" />
          </button>
          <button
            onClick={() => reload(active)}
            disabled={!active.initialUrl}
            aria-label={active.loading ? 'Stop' : 'Reload'}
            className={iconButton}
          >
            {active.loading ? <CloseGlyph className="w-4 h-4" /> : <RefreshGlyph className="w-4 h-4" />}
          </button>
          <UrlBar key={active.id} tab={active} />
          <Tooltip label="Open in your browser">
            <button
              onClick={() => void window.crew.openExternal(active.url)}
              disabled={!active.url}
              aria-label="Open in your browser"
              className={iconButton}
            >
              <ExternalLinkGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      )}

      <div className="app-no-drag flex-1 min-h-0 relative border-t border-ink-700">
        {tabs
          .filter(tab => (tab.kind === 'web' || tab.kind === 'image') && tab.initialUrl)
          .map(tab =>
            showsImage(tab) ? (
              <div
                key={tab.id}
                className="absolute inset-0 bg-ink-900"
                style={{ visibility: tab.id === activeTabId ? 'visible' : 'hidden' }}
              >
                <ImageView key={tab.generation} src={tab.initialUrl} alt={tabLabel(tab)} />
              </div>
            ) : (
              <BrowserTabView key={tab.id} tab={tab} active={tab.id === activeTabId} />
            )
          )}
        {tabs
          .filter(tab => tab.kind === 'file')
          .map(tab => (
            <FileView key={tab.id} tab={tab} active={tab.id === activeTabId} />
          ))}
        {tabs
          .filter(tab => tab.kind === 'terminal')
          .map(tab => (
            <TerminalView key={tab.id} tab={tab} active={tab.id === activeTabId} />
          ))}
        {active && active.kind === 'music' && <MusicView />}
        {active && active.kind === 'game' && <GameView tabId={active.id} />}
        {active && active.kind === 'web' && !active.initialUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <GlobeGlyph className="w-8 h-8 text-fg-faint" />
            <p className="text-sm text-fg-muted">Search or enter a web address above</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TabPill({ tab, active }: { tab: BrowserTab; active: boolean }) {
  const pillRef = useRef<HTMLButtonElement>(null)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (active) pillRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <>
      <button
        ref={pillRef}
        data-tab={tab.id}
        onClick={() => useBrowser.getState().selectTab(tab.id)}
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }}
        className={`group flex items-center gap-1.5 h-9 pl-3 pr-1.5 rounded-full text-sm font-medium max-w-[180px] shrink-0 transition-all duration-150 active:scale-95 ${
          active
            ? 'bg-ink-800 text-fg'
            : menuAt
              ? 'text-fg-secondary bg-fg/[0.04]'
              : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
        }`}
      >
        {tab.loading ? (
          <Spinner size={14} className="text-fg-muted" />
        ) : tab.kind === 'music' ? (
          <MusicGlyph className="w-4 h-4 shrink-0" />
        ) : tab.kind === 'game' ? (
          <GameGlyph className="w-4 h-4 shrink-0" />
        ) : tab.kind === 'terminal' ? (
          <TerminalGlyph className="w-4 h-4 shrink-0" />
        ) : tab.kind === 'file' ? (
          tab.path ? (
            <DocGlyph className="w-4 h-4 shrink-0" />
          ) : (
            <FolderGlyph className="w-4 h-4 shrink-0" />
          )
        ) : showsImage(tab) ? (
          <PhotoGlyph className="w-4 h-4 shrink-0" />
        ) : tab.favicon ? (
          <img src={tab.favicon} alt="" className="w-4 h-4 shrink-0 rounded-sm" />
        ) : (
          <GlobeGlyph className="w-4 h-4 shrink-0" />
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
          <CloseGlyph className="w-3 h-3" />
        </span>
      </button>
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined}>
        <MenuItem
          icon={<CloseGlyph />}
          label="Close tab"
          onClick={() => {
            setMenuAt(null)
            useBrowser.getState().closeTab(tab.id)
          }}
        />
        <MenuItem
          icon={<XCircleGlyph />}
          label="Close all tabs"
          onClick={() => {
            setMenuAt(null)
            useBrowser.getState().closeAll()
          }}
        />
      </Popover>
    </>
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
