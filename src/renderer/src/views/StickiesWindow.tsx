import { useEffect, useState } from 'react'
import { STICKY_COLORS, type Sticky, type StickyColor } from '../../../shared/stickies'
import { stickyIdInHash } from '../../../shared/threadViews'
import StickyEditor from '../components/StickyEditor'
import StickySidebar, { stickyColorValue, stickyLabel } from '../components/StickySidebar'
import Spinner from '../components/Spinner'
import Tooltip from '../components/Tooltip'
import { PanelLeftGlyph, PinGlyph } from '../icons'
import { createSticky, updateSticky, useStickies, useStickiesLoaded } from '../state/stickies'
import { useWindowName } from '../state/windowName'
import { setWindowPinned, useWindowPinned } from '../state/windowShape'

function ColorChoices({ sticky }: { sticky: Sticky }) {
  return (
    <div className="app-no-drag flex items-center gap-1" aria-label="Sticky color">
      {STICKY_COLORS.map(color => (
        <Tooltip key={color} label={color[0].toUpperCase() + color.slice(1)}>
          <button
            onClick={() => void updateSticky(sticky.id, { color })}
            aria-label={`${color} sticky`}
            aria-pressed={sticky.color === color}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-[background-color,transform] active:scale-95 ${
              sticky.color === color ? 'bg-fg/[0.08]' : 'hover:bg-fg/[0.05]'
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full ring-1 ring-inset ${
                sticky.color === color ? 'ring-fg/40' : 'ring-fg/10'
              }`}
              style={{ backgroundColor: stickyColorValue(color as StickyColor) }}
            />
          </button>
        </Tooltip>
      ))}
    </div>
  )
}

function MissingSticky({ loaded }: { loaded: boolean }) {
  return loaded ? (
    <p className="h-full flex items-center justify-center px-8 text-base text-fg-muted text-center">
      This sticky is not here any more.
    </p>
  ) : (
    <div className="h-full flex items-center justify-center">
      <Spinner size={20} />
    </div>
  )
}

function SingleSticky({ sticky, loaded }: { sticky?: Sticky; loaded: boolean }) {
  const pinned = useWindowPinned()
  useWindowName(sticky ? stickyLabel(sticky) : 'Sticky')

  return (
    <div data-sticky-window className="h-full relative bg-ink-900">
      <header className="app-drag absolute z-40 top-0 inset-x-0 h-[54px] pl-[88px] pr-3 flex items-center border-b border-ink-700 bg-ink-900/90 backdrop-blur-xl">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg/70">
          {sticky ? stickyLabel(sticky) : 'Sticky'}
        </span>
        {sticky && <ColorChoices sticky={sticky} />}
        <Tooltip label={pinned ? 'Stop keeping on top' : 'Keep on top'}>
          <button
            onClick={() => void window.crew.setWindowPinned(!pinned).then(setWindowPinned)}
            aria-label={pinned ? 'Stop keeping on top' : 'Keep on top'}
            aria-pressed={pinned}
            className={`app-no-drag ml-1 w-8 h-8 rounded-full flex items-center justify-center transition-[color,background-color,transform] active:scale-95 ${
              pinned ? 'text-fg bg-fg/[0.08]' : 'text-fg/45 hover:text-fg hover:bg-fg/[0.05]'
            }`}
          >
            <PinGlyph className="w-4 h-4" />
          </button>
        </Tooltip>
      </header>
      <div className="h-full pt-[54px]">{sticky ? <StickyEditor sticky={sticky} /> : <MissingSticky loaded={loaded} />}</div>
    </div>
  )
}

export default function StickiesWindow() {
  const individualId = stickyIdInHash(window.location.hash)
  const stickies = useStickies()
  const loaded = useStickiesLoaded()
  const [active, setActive] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const individual = individualId ? stickies.find(sticky => sticky.id === individualId) : undefined
  const current = active ? stickies.find(sticky => sticky.id === active) : undefined

  useEffect(() => {
    if (individualId || !loaded) return
    if (!active || !stickies.some(sticky => sticky.id === active)) setActive(stickies[0]?.id ?? null)
  }, [active, individualId, loaded, stickies])

  useWindowName(individualId ? '' : current ? stickyLabel(current) : 'Stickies')

  if (individualId) return <SingleSticky sticky={individual} loaded={loaded} />

  const add = async () => {
    const sticky = await createSticky()
    setActive(sticky.id)
    setFresh(sticky.id)
  }

  return (
    <div data-stickies-library className="h-full relative flex bg-ink-900">
      <StickySidebar
        stickies={stickies}
        active={active}
        collapsed={collapsed}
        onOpen={id => {
          setActive(id)
          setFresh(null)
        }}
        onNew={() => void add()}
        onCollapse={() => setCollapsed(true)}
      />
      <main className="flex-1 min-w-0 relative">
        {collapsed && (
          <div className="app-drag absolute top-0 left-0 z-40 h-[70px] pl-[92px] flex items-center">
            <Tooltip label="Show sticky list">
              <button
                onClick={() => setCollapsed(false)}
                aria-label="Show sticky list"
                className="app-no-drag w-9 h-9 rounded-full flex items-center justify-center text-fg-muted transition-[color,background-color,transform] duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
              >
                <PanelLeftGlyph className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        )}
        {current ? (
          <StickyEditor sticky={current} fresh={fresh === current.id} />
        ) : loaded ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-8">
            <p className="text-sm text-fg/45">Keep a thought close.</p>
            <button
              onClick={() => void add()}
              className="h-9 px-4 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-[background-color,transform] hover:bg-fg/90 active:scale-95"
            >
              New sticky
            </button>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <Spinner size={20} />
          </div>
        )}
      </main>
    </div>
  )
}
