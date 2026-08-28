import { Fragment, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { canPreview, isSvg } from '../../../shared/files'
import { normalizeUrl } from '../../../shared/urls'
import {
  ArrowLeftGlyph,
  ArrowRightGlyph,
  CloseGlyph,
  CloseOthersGlyph,
  CollapseGlyph,
  DocGlyph,
  ExternalLinkGlyph,
  ExpandGlyph,
  FolderGlyph,
  GlobeGlyph,
  PanelRightGlyph,
  PinGlyph,
  PopOutGlyph,
  PlusGlyph,
  RefreshGlyph,
  XCircleGlyph
} from '../icons'
import { useBrowser, type BrowserTab } from '../state/browser'
import { useCrew } from '../state/store'
import { useFullScreen } from '../state/windowShape'
import { usePanelOpens, type PanelOpen } from './panelOpens'
import { bringInto } from './scrollInto'
import { useReorder, type Reorder } from './useReorder'
import { useScrollFade } from './useScrollFade'
import AsideView from './AsideView'
import AttachmentView from './attachment/AttachmentView'
import BrowserTabMark, { browserTabCard, browserTabLabel, showsImage } from './BrowserTabMark'
import BrowserTabSwitcher from './BrowserTabSwitcher'
import BrowserTabView, { viewFor } from './BrowserTabView'
import BrowserFind, { BrowserFindButton } from './BrowserFind'
import FileView, { FileCrumbs } from './FileView'
import GameView from './game/GameView'
import HoverCard from './HoverCard'
import ImageView from './ImageView'
import MusicView from './music/MusicView'
import PlanView from './PlanView'
import ReviewView from './review/ReviewView'
import WorkView from './work/WorkView'
import SubagentPanel from './subagents/SubagentPanel'
import { MenuDivider, MenuItem, Popover } from './Popover'
import Spinner from './Spinner'
import TerminalView from './TerminalView'
import Tooltip from './Tooltip'
export { showsImage } from './BrowserTabMark'

const BROWSER_TAB_DRAG = 'application/x-crew-browser-tab'
const TAB_SCROLL_EDGE = 56
const TAB_SCROLL_STEP = 12

function scrollTabStrip(strip: HTMLElement, x: number): void {
  const box = strip.getBoundingClientRect()
  const at = x - box.left
  if (at < TAB_SCROLL_EDGE) strip.scrollLeft -= TAB_SCROLL_STEP
  else if (at > box.width - TAB_SCROLL_EDGE) strip.scrollLeft += TAB_SCROLL_STEP
}

function tabDropIndex(strip: HTMLElement, x: number): number {
  const tabs = Array.from(strip.querySelectorAll<HTMLElement>('[data-tab]'))
  const after = tabs.findIndex(tab => {
    const box = tab.getBoundingClientRect()
    return x < box.left + box.width / 2
  })
  return after < 0 ? tabs.length : after
}

function tabDropLeft(strip: HTMLElement, index: number): number {
  const tabs = Array.from(strip.querySelectorAll<HTMLElement>('[data-tab]'))
  const next = tabs[index]
  if (next) return next.offsetLeft - 4
  const last = tabs[tabs.length - 1]
  return last ? last.offsetLeft + last.offsetWidth + 4 : 16
}

// A helper tab wears the mark of the helper it is reading, which is what makes
// a row of three of them read at a glance. The list of them wears the same mark
// the Helpers page in the settings does, since it is the same list.
const iconButton =
  'w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95 disabled:opacity-30 disabled:pointer-events-none'

export default function BrowserPanel({ standalone = false }: { standalone?: boolean }) {
  const tabs = useBrowser(s => s.tabs)
  const activeTabId = useBrowser(s => s.activeTabId)
  const panelFullScreen = useBrowser(s => s.fullScreen)
  const windowFullScreen = useFullScreen()
  const active = tabs.find(t => t.id === activeTabId) ?? null
  const [newOpen, setNewOpen] = useState(false)
  const [finding, setFinding] = useState(false)
  const [findFocus, setFindFocus] = useState(0)
  const opens = usePanelOpens()
  const strip = useRef<HTMLDivElement | null>(null)
  const draggedTab = useRef<{ token: string; id: string } | null>(null)
  const row = useReorder((id, to) => useBrowser.getState().moveTab(id, to))
  const [tabDrop, setTabDrop] = useState<{ at: number; left: number } | null>(null)
  useScrollFade(strip, 'horizontal')
  // The plan comes with the thread you are in and goes when you leave it.
  const planThread = useCrew(s => (s.openThreadId && s.threads[s.openThreadId]?.plan ? s.openThreadId : null))

  // The board does the same, and only for a thread that was asked for one.
  const boardThread = useCrew(s => (s.openThreadId && s.threads[s.openThreadId]?.tickets ? s.openThreadId : null))

  // The helpers a thread sent out go with the thread, so what is left in the row
  // is about the threads you are in. Every way back to them is a press away: the
  // chips in the thread, the button in its header, or the panel's own list.
  const openThreadIds = useCrew(s => s.openThreadIds)

  useEffect(() => {
    useBrowser.getState().leaveThreads(openThreadIds)
  }, [openThreadIds])

  useEffect(() => {
    const browser = useBrowser.getState()
    if (boardThread && !browser.closedBoards.includes(boardThread)) browser.showWork(boardThread)
    else browser.hideWork()
  }, [boardThread])

  useEffect(() => {
    const browser = useBrowser.getState()
    if (planThread && !browser.closedPlans.includes(planThread)) browser.showPlan(planThread)
    else browser.hidePlan()
  }, [planThread])

  useEffect(() => setFinding(false), [activeTabId])

  useEffect(() => {
    const listen = window.crew?.onFindInPage
    if (!listen) return
    return listen(() => {
      const browser = useBrowser.getState()
      const tab = browser.tabs.find(one => one.id === browser.activeTabId)
      if (browser.open && tab?.kind === 'web' && tab.initialUrl) {
        setFinding(true)
        setFindFocus(value => value + 1)
      }
    })
  }, [])

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
      <header
        className={`app-drag h-[70px] px-4 flex items-center gap-1.5 shrink-0 ${
          (standalone || panelFullScreen) && !windowFullScreen ? 'mac:pl-[92px]' : ''
        }`}
      >
        <div
          ref={node => {
            row.ref(node)
            strip.current = node
          }}
          onDragOver={(event: DragEvent<HTMLDivElement>) => {
            if (!event.dataTransfer.types.includes(BROWSER_TAB_DRAG)) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            scrollTabStrip(event.currentTarget, event.clientX)
            const at = tabDropIndex(event.currentTarget, event.clientX)
            setTabDrop({ at, left: tabDropLeft(event.currentTarget, at) })
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTabDrop(null)
          }}
          onDrop={event => {
            const token = event.dataTransfer.getData(BROWSER_TAB_DRAG)
            if (!token) return
            event.preventDefault()
            const to = tabDropIndex(event.currentTarget, event.clientX)
            if (draggedTab.current?.token === token) useBrowser.getState().dropTab(draggedTab.current.id, to)
            draggedTab.current = null
            setTabDrop(null)
            void window.crew.dropBrowserTab(token, to)
          }}
          className="scroll-fade-x app-no-drag relative -ml-4 pl-4 flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar"
        >
          {tabs.length === 0 && <StartPill />}
          {tabs.map(tab => (
            <TabPill
              key={tab.id}
              tab={tab}
              active={tab.id === activeTabId}
              row={row}
              strip={strip}
              onDrag={value => {
                draggedTab.current = value
              }}
            />
          ))}
          {tabDrop && (
            <span
              data-browser-tab-drop={tabDrop.at}
              className="pointer-events-none absolute top-1/2 z-10 h-6 w-0.5 -translate-y-1/2 rounded-full bg-fg"
              style={{ left: tabDrop.left }}
            />
          )}
        </div>
        <BrowserTabSwitcher tabs={tabs} activeTabId={activeTabId} />
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
            {opens.map((one, index) => (
              <Fragment key={one.id}>
                {one.scope === 'panel' && opens[index - 1]?.scope === 'thread' && <MenuDivider />}
                <MenuItem
                  icon={one.mark}
                  label={one.label}
                  onClick={() => {
                    setNewOpen(false)
                    one.open()
                  }}
                />
              </Fragment>
            ))}
          </Popover>
        </span>
        {!standalone && (
          <>
            <Tooltip label={panelFullScreen ? 'Exit full screen' : 'Full screen'}>
              <button
                onClick={() => useBrowser.getState().toggleFullScreen()}
                aria-label={panelFullScreen ? 'Exit full screen' : 'Full screen'}
                aria-pressed={panelFullScreen}
                className={`app-no-drag ${iconButton}`}
              >
                {panelFullScreen ? <CollapseGlyph className="w-4 h-4" /> : <ExpandGlyph className="w-4 h-4" />}
              </button>
            </Tooltip>
            <Tooltip label="Close">
              <button
                onClick={() => useBrowser.getState().closePanel()}
                aria-label="Close"
                className={`app-no-drag ${iconButton}`}
              >
                <CloseGlyph className="w-4 h-4" />
              </button>
            </Tooltip>
          </>
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
          <button onClick={() => useBrowser.getState().reloadTab(active.id)} aria-label="Reload" className={iconButton}>
            <RefreshGlyph className="w-4 h-4" />
          </button>
          <FileCrumbs tab={active} />
          {canPreview(active.path) && (
            <Tooltip
              label={
                active.preview && isSvg(active.path)
                  ? 'Show contents'
                  : active.preview
                    ? 'Hide preview'
                    : 'Show preview'
              }
            >
              <button
                onClick={() => useBrowser.getState().togglePreview(active.id)}
                aria-label={
                  active.preview && isSvg(active.path)
                    ? 'Show contents'
                    : active.preview
                      ? 'Hide preview'
                      : 'Show preview'
                }
                aria-pressed={active.preview}
                className={`${iconButton} ${active.preview ? 'text-fg bg-fg/[0.06]' : ''}`}
              >
                <DocGlyph className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
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
          <Tooltip label={finding ? 'Close find' : 'Find in page'} disabled={finding}>
            <BrowserFindButton
              open={finding}
              disabled={!active.initialUrl}
              onClick={() => {
                setFinding(open => !open)
                if (!finding) setFindFocus(value => value + 1)
              }}
            />
          </Tooltip>
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
        {active?.kind === 'web' && active.initialUrl && finding && (
          <BrowserFind key={active.id} tabId={active.id} focus={findFocus} onClose={() => setFinding(false)} />
        )}
        {tabs
          .filter(tab => (tab.kind === 'web' || tab.kind === 'image') && tab.initialUrl)
          .map(tab =>
            showsImage(tab) ? (
              <div
                key={tab.id}
                className="absolute inset-0 bg-ink-900"
                style={{ visibility: tab.id === activeTabId ? 'visible' : 'hidden' }}
              >
                <ImageView key={tab.generation} src={tab.initialUrl} alt={browserTabLabel(tab)} />
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
        {tabs
          .filter(tab => tab.kind === 'attachment')
          .map(tab => (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ visibility: tab.id === activeTabId ? 'visible' : 'hidden' }}
            >
              <AttachmentView tab={tab} />
            </div>
          ))}
        {tabs
          .filter(tab => tab.kind === 'agent')
          .map(tab => (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ visibility: tab.id === activeTabId ? 'visible' : 'hidden' }}
            >
              <SubagentPanel tab={tab} />
            </div>
          ))}
        {tabs
          .filter(tab => tab.kind === 'aside')
          .map(tab => (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ visibility: tab.id === activeTabId ? 'visible' : 'hidden' }}
            >
              <AsideView threadId={tab.threadId} />
            </div>
          ))}
        {active && active.kind === 'plan' && <PlanView threadId={active.threadId} />}
        {active && active.kind === 'work' && <WorkView threadId={active.threadId} />}
        {active && active.kind === 'review' && <ReviewView />}
        {active && active.kind === 'music' && <MusicView />}
        {active && active.kind === 'game' && <GameView tabId={active.id} />}
        {active && active.kind === 'web' && !active.initialUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <GlobeGlyph className="w-8 h-8 text-fg-faint" />
            <p className="text-sm text-fg-muted">Search or enter a web address above</p>
          </div>
        )}
        {active?.kind === 'web' && active.initialUrl && active.loading && (
          <div className="absolute inset-0 z-10 bg-ink-900 flex items-center justify-center">
            <Spinner size={20} />
          </div>
        )}
        {active?.kind === 'web' && active.initialUrl && active.error && (
          <div className="absolute inset-0 z-10 bg-ink-900 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <XCircleGlyph className="w-8 h-8 text-fg-faint" />
            <div>
              <p className="text-base text-fg">{active.pluginLabel || 'This page'} could not open</p>
              <p className="mt-1 text-sm text-fg-muted">{active.error}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => useBrowser.getState().reloadTab(active.id)}
                className="h-9 px-4 rounded-full bg-fg text-ink-900 text-sm font-medium hover:bg-fg/90 active:scale-95"
              >
                Retry
              </button>
              <button
                onClick={() => void window.crew.openExternal(active.url || active.initialUrl)}
                className="h-9 px-4 rounded-full border border-fg/15 text-sm text-fg-secondary hover:border-fg/25 hover:bg-fg/[0.04] hover:text-fg active:scale-95"
              >
                Open in browser
              </button>
            </div>
          </div>
        )}
        {tabs.length === 0 && <PanelOpens opens={opens} />}
      </div>
    </div>
  )
}

// The panel opened on nothing stands on Start, so what is on screen is always a
// tab and the last tab out is what puts the panel away. There is no close on it:
// closing it is closing the panel, and that button is already an inch to the
// right of it.
function StartPill() {
  return (
    <span className="shrink-0 select-none flex items-center gap-1.5 h-9 px-3 rounded-full bg-ink-800 text-sm font-medium text-fg">
      <PanelRightGlyph className="w-4 h-4 shrink-0" />
      Start
    </span>
  )
}

// What Start holds: the same rows the plus opens, standing where the thing they
// open would be. A line over them naming what they are would be the screen read
// back to whoever is already looking at it.
function PanelOpens({ opens }: { opens: PanelOpen[] }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2 px-4 select-none">
      {opens.map(one => (
        <button
          key={one.id}
          onClick={one.open}
          className="group w-full h-14 px-4 rounded-2xl bg-ink-800 flex items-center gap-3 text-left transition-all duration-150 hover:bg-ink-700 active:scale-[0.99]"
        >
          <span className="w-5 h-5 shrink-0 flex items-center justify-center text-fg-muted transition-colors duration-150 group-hover:text-fg">
            {one.mark}
          </span>
          <span className="text-sm font-medium text-fg truncate">{one.label}</span>
        </button>
      ))}
    </div>
  )
}

function TabPill({
  tab,
  active,
  row,
  strip,
  onDrag
}: {
  tab: BrowserTab
  active: boolean
  row: Reorder
  strip: { current: HTMLDivElement | null }
  onDrag: (value: { token: string; id: string } | null) => void
}) {
  const pillRef = useRef<HTMLButtonElement>(null)
  const [name, setName] = useState<HTMLSpanElement | null>(null)
  const [clipped, setClipped] = useState(false)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const others = useBrowser(s => s.tabs.some(one => one.id !== tab.id && !one.pinned))
  const after = useBrowser(s => {
    const index = s.tabs.findIndex(one => one.id === tab.id)
    return s.tabs.some((one, at) => at > index && !one.pinned)
  })
  const unpinned = useBrowser(s => s.tabs.some(one => !one.pinned))

  useEffect(() => {
    if (active && pillRef.current) bringInto(pillRef.current, strip.current, 'smooth')
  }, [active, strip])

  const label = browserTabLabel(tab)

  useEffect(() => {
    if (!name) return
    const measure = () => setClipped(name.scrollWidth > name.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(name)
    return () => observer.disconnect()
  }, [name, label])

  return (
    <>
      <button
        ref={pillRef}
        data-tab={tab.id}
        data-reorder={tab.id}
        data-active={active ? '' : undefined}
        data-pinned={tab.pinned ? '' : undefined}
        draggable
        onDragStart={event => {
          row.cancel()
          const token = crypto.randomUUID()
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData(BROWSER_TAB_DRAG, token)
          if (!window.crew.beginBrowserTabDrag(token, tab)) {
            event.preventDefault()
            return
          }
          onDrag({ token, id: tab.id })
        }}
        onDragEnd={() => onDrag(null)}
        onPointerDown={row.take(tab.id)}
        onClick={() => {
          if (!row.dragged()) useBrowser.getState().selectTab(tab.id)
        }}
        onAuxClick={event => {
          if (event.button !== 1) return
          event.preventDefault()
          useBrowser.getState().closeTab(tab.id)
        }}
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }}
        // Everything but where a pill stands is transitioned, since where it
        // stands is written by the drag itself and has to keep up with a pointer.
        className={`browser-tab group relative flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium max-w-[180px] shrink-0 transition-[color,background-color,scale] duration-150 active:scale-95 ${
          active
            ? 'bg-ink-800 text-fg'
            : menuAt
              ? 'text-fg-secondary bg-fg/[0.04]'
              : 'text-fg-muted hover:text-fg-secondary hover:bg-fg/[0.04]'
        }`}
      >
        <HoverCard className="min-w-0" content={menuAt ? null : browserTabCard(tab, clipped)}>
          <span className="flex min-w-0 items-center gap-1.5">
            <BrowserTabMark tab={tab} />
            <span ref={setName} className="truncate">
              {label}
            </span>
          </span>
        </HoverCard>
        {tab.pinned && <PinGlyph className="w-3 h-3 shrink-0 text-fg-faint" />}
        <span className="browser-tab-close pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-end rounded-r-full pr-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <span
            onPointerDown={event => event.stopPropagation()}
            onClick={event => {
              event.stopPropagation()
              useBrowser.getState().closeTab(tab.id)
            }}
            aria-label="Close tab"
            className="pointer-events-auto flex h-5 w-5 items-center justify-center rounded-full hover:bg-fg/10"
          >
            <CloseGlyph className="w-3 h-3" />
          </span>
        </span>
      </button>
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined}>
        <MenuItem
          icon={<PopOutGlyph />}
          label="Open in new window"
          onClick={() => {
            setMenuAt(null)
            void window.crew.popOutBrowserTab(tab)
          }}
        />
        <MenuItem
          icon={<PinGlyph />}
          label={tab.pinned ? 'Unpin tab' : 'Pin tab'}
          onClick={() => {
            setMenuAt(null)
            useBrowser.getState().togglePinned(tab.id)
          }}
        />
        <MenuDivider />
        <MenuItem
          icon={<CloseGlyph />}
          label="Close tab"
          onClick={() => {
            setMenuAt(null)
            useBrowser.getState().closeTab(tab.id)
          }}
        />
        {others && (
          <MenuItem
            icon={<CloseOthersGlyph />}
            label="Close other tabs"
            onClick={() => {
              setMenuAt(null)
              useBrowser.getState().closeOthers(tab.id)
            }}
          />
        )}
        {after && (
          <MenuItem
            icon={<CloseOthersGlyph />}
            label="Close tabs to the right"
            onClick={() => {
              setMenuAt(null)
              useBrowser.getState().closeAfter(tab.id)
            }}
          />
        )}
        {unpinned && (
          <MenuItem
            icon={<XCircleGlyph />}
            label="Close all tabs"
            onClick={() => {
              setMenuAt(null)
              useBrowser.getState().closeAll()
            }}
          />
        )}
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
