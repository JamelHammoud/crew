import { useEffect, useState } from 'react'
import { STICKY_COLORS, type Sticky } from '../../../shared/stickies'
import { stickyIdInHash } from '../../../shared/threadViews'
import StickyEditor from '../components/StickyEditor'
import StickySidebar, { stickyColorValue, stickyLabel } from '../components/StickySidebar'
import Spinner from '../components/Spinner'
import Tooltip from '../components/Tooltip'
import { MenuDivider, MenuItem, Popover } from '../components/Popover'
import { PanelLeftGlyph, PinGlyph, TrashGlyph } from '../icons'
import { deleteSticky, updateSticky, useStickies, useStickiesLoaded } from '../state/stickies'
import { useWindowName } from '../state/windowName'

function StickyWindowMenu({ sticky, close }: { sticky: Sticky; close: () => void }) {
  const take = (action: () => void) => {
    close()
    action()
  }

  return (
    <>
      <MenuItem
        icon={<PinGlyph />}
        label={sticky.pinned ? 'Stop keeping on top' : 'Keep on top'}
        onClick={() => take(() => void updateSticky(sticky.id, { pinned: !sticky.pinned }))}
      />
      <MenuDivider />
      {STICKY_COLORS.map(color => (
        <MenuItem
          key={color}
          icon={
            <span
              className="block w-3.5 h-3.5 rounded-full ring-1 ring-inset ring-fg/10"
              style={{ backgroundColor: stickyColorValue(color) }}
            />
          }
          label={color[0].toUpperCase() + color.slice(1)}
          checked={sticky.color === color}
          onClick={() => take(() => void updateSticky(sticky.id, { color }))}
        />
      ))}
      <MenuDivider />
      <MenuItem
        icon={<TrashGlyph />}
        label="Delete sticky"
        danger
        onClick={() => take(() => void deleteSticky(sticky.id))}
      />
    </>
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

function stickyDraft(): Sticky {
  const now = Date.now()
  return {
    id: `draft:${crypto.randomUUID()}`,
    body: '',
    color: 'default',
    pinned: false,
    createdAt: now,
    updatedAt: now
  }
}

function SingleSticky({ sticky, loaded }: { sticky?: Sticky; loaded: boolean }) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  return (
    <div
      data-sticky-window
      onContextMenu={event => {
        if (!sticky) return
        const target = event.target as HTMLElement
        if (target.closest('input, textarea, [contenteditable="true"], a, button')) return
        event.preventDefault()
        setMenuAt({ x: event.clientX, y: event.clientY })
      }}
      className="h-full relative bg-ink-900"
    >
      <div className="app-drag absolute z-40 top-0 inset-x-0 h-10 pointer-events-none" />
      {sticky ? <StickyEditor sticky={sticky} compact /> : <MissingSticky loaded={loaded} />}
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined} className="min-w-52">
        {sticky && <StickyWindowMenu sticky={sticky} close={() => setMenuAt(null)} />}
      </Popover>
    </div>
  )
}

export default function StickiesWindow() {
  const individualId = stickyIdInHash(window.location.hash)
  const stickies = useStickies()
  const loaded = useStickiesLoaded()
  const [draft, setDraft] = useState<Sticky | null>(() => stickyDraft())
  const [active, setActive] = useState<string | null>(() => draft?.id ?? null)
  const [fresh, setFresh] = useState<string | null>(() => draft?.id ?? null)
  const [collapsed, setCollapsed] = useState(false)
  const individual = individualId ? stickies.find(sticky => sticky.id === individualId) : undefined
  const current = active ? (draft?.id === active ? draft : stickies.find(sticky => sticky.id === active)) : undefined

  useEffect(() => {
    if (individualId) return
    if (draft?.id === active) return
    if (active && stickies.some(sticky => sticky.id === active)) return
    const next = stickyDraft()
    setDraft(next)
    setActive(next.id)
    setFresh(next.id)
  }, [active, draft, individualId, stickies])

  useWindowName(
    individualId ? (individual ? stickyLabel(individual) : 'Sticky') : current ? stickyLabel(current) : 'Stickies'
  )

  if (individualId) return <SingleSticky sticky={individual} loaded={loaded} />

  const add = () => {
    const sticky = stickyDraft()
    setDraft(sticky)
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
          setDraft(null)
          setActive(id)
          setFresh(null)
        }}
        onNew={add}
        onCollapse={() => setCollapsed(true)}
      />
      <main className="flex-1 min-w-0 relative">
        <div
          data-stickies-drag-region
          className="app-drag pointer-events-none absolute inset-x-0 top-0 z-30 h-[70px]"
        />
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
        {current && (
          <StickyEditor
            sticky={current}
            fresh={fresh === current.id}
            draft={current.id === draft?.id}
            onCreated={created => {
              setDraft(null)
              setFresh(null)
              setActive(created.id)
            }}
          />
        )}
      </main>
    </div>
  )
}
