import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { projectPlace } from '../../../shared/places'
import type { CrewHome } from '../../../shared/project'
import { said } from '../api/said'
import { playSound } from '../media/sounds'
import { usePlaces } from '../state/places'
import { SIDEBAR_W, useSidebar } from '../state/sidebar'
import { useCrew } from '../state/store'
import { toast } from '../state/toast'
import type { Place } from '../views/home/place'
import TabIcon from './TabIcon'
import { TABS, type Tab } from './navTabs'
import NewPlace from './sidebar/NewPlace'
import PlaceFace from './sidebar/PlaceFace'
import PlaceGroup from './sidebar/PlaceGroup'
import { NO_THREADS } from './sidebar/placeItems'
import { useReorder } from './useReorder'
import { useScrollFade } from './useScrollFade'

const EMPTY_THREADS: string[] = []

export default function Sidebar({
  overlay,
  strong,
  tab,
  onTab
}: {
  overlay?: boolean
  strong?: boolean
  tab: Tab
  onTab: (tab: Tab) => void
}) {
  const places = usePlaces(s => s.places)
  const live = usePlaces(s => s.live)
  const load = usePlaces(s => s.load)
  const move = usePlaces(s => s.move)
  const here = useCrew(s => s.place)
  const openThreadIds = useCrew(s => s.openThreadIds)
  const name = useCrew(s => s.selfName)
  const switchTo = useCrew(s => s.switchTo)
  const closePlace = useCrew(s => s.closePlace)
  const peek = useSidebar(s => s.peek)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const order = useReorder((key, to) => move(key, to), {
    axis: 'vertical',
    carry: key => {
      const place = places.find(one => one.key === key)
      return place ? <PlaceFace place={place} lit /> : null
    }
  })
  const scroller = useRef<HTMLDivElement | null>(null)
  useScrollFade(scroller)

  const held = useRef(order)
  held.current = order
  const take = useCallback((key: string) => held.current.take(key), [])
  const dragged = useCallback(() => held.current.dragged(), [])

  const threadsOf = useMemo(() => new Map(live.map(place => [place.key, place.threads])), [live])
  const liveKeys = useMemo(() => new Set(live.map(place => place.key)), [live])

  useEffect(() => {
    void load()
  }, [load])

  const busyRef = useRef<string | null>(null)
  const setBusy = useCallback((key: string | null) => {
    busyRef.current = key
    setBusyKey(key)
  }, [])

  const open = useCallback(
    async (folder: string, key: string, home?: CrewHome) => {
      setBusy(key)
      try {
        useCrew.getState().connect(await window.crew.start(folder, name, home ? { home } : undefined))
      } catch (err) {
        toast.fail(said(err), { key: 'open-place' })
      } finally {
        setBusy(null)
      }
    },
    [name, setBusy]
  )

  const go = useCallback(
    async (place: Place): Promise<boolean> => {
      if (busyRef.current) return false
      peek(false)
      if (usePlaces.getState().live.some(one => one.key === place.key)) {
        await switchTo(place.key)
        return true
      }
      if (place.key === here) return true
      if (place.join) {
        setBusy(place.key)
        try {
          useCrew.getState().connect(await window.crew.join(place.join.link, place.join.folder, place.join.name))
          return true
        } catch (err) {
          toast.fail(said(err), { key: 'open-place' })
          return false
        } finally {
          setBusy(null)
        }
      }
      if (!place.project) return false
      await open(place.project.folder, place.key)
      return true
    },
    [here, open, peek, setBusy, switchTo]
  )

  const goToPlace = useCallback(
    (place: Place) => {
      useCrew.getState().wantThread(null)
      void go(place)
    },
    [go]
  )

  const goToThread = useCallback(
    (place: Place, threadId: string, toRight: boolean) => {
      useCrew.getState().wantThread(threadId)
      if (place.key === here) {
        if (toRight) useCrew.getState().openThread(threadId)
        else useCrew.getState().openThreadAlone(threadId)
      } else void go(place)
    },
    [go, here]
  )

  const goToTab = useCallback(
    (next: Tab) => {
      peek(false)
      if (next !== tab) playSound(`tab.${next}`)
      onTab(next)
    },
    [onTab, peek, tab]
  )

  const stop = useCallback((place: Place) => void closePlace(place.key), [closePlace])

  const forget = useCallback(
    async (place: Place) => {
      if (place.project) await window.crew.forgetProject(place.project.folder).catch(() => {})
      if (place.join) await window.crew.forgetJoin(place.join.link).catch(() => {})
      await load()
    },
    [load]
  )

  const forgetPlace = useCallback((place: Place) => void forget(place), [forget])

  const addPlace = useCallback(
    (folder: string, home?: CrewHome) => void open(folder, projectPlace(folder), home),
    [open]
  )

  return (
    <aside
      style={{ width: SIDEBAR_W }}
      className={`h-full flex flex-col ${
        overlay
          ? `glass sidebar-glass rounded-r-card ${strong ? 'glass-strong' : ''}`
          : 'sidebar-pinned bg-ink-800 border-r border-[var(--glass-line)]'
      }`}
    >
      <div className="app-drag h-[70px] shrink-0" />
      <nav aria-label="Main navigation" className="app-no-drag shrink-0 px-2 flex flex-col gap-0.5">
        {TABS.map(one => (
          <button
            key={one.id}
            onClick={() => goToTab(one.id)}
            aria-current={tab === one.id ? 'page' : undefined}
            className={`w-full rounded-xl px-2 py-1.5 flex items-center gap-2 text-left text-sm font-medium transition-[color,background-color,scale] duration-150 active:scale-[0.99] ${
              tab === one.id ? 'bg-fg/[0.08] text-fg' : 'text-fg/70 hover:bg-fg/[0.06] hover:text-fg'
            }`}
          >
            <span className={tab === one.id ? 'text-fg/70' : 'text-fg/45'}>
              <TabIcon tab={one.id} size={18} />
            </span>
            {one.label}
          </button>
        ))}
      </nav>
      <h2 className="app-no-drag shrink-0 px-4 pt-5 pb-1 text-xs font-medium text-fg/45">Projects</h2>
      <div
        ref={node => {
          scroller.current = node
          order.ref(node)
        }}
        className="scroll-fade relative flex-1 min-h-0 overflow-y-auto app-no-drag px-2 pt-2 pb-3"
      >
        {order.view}
        <div className="flex flex-col gap-3">
          {places.map(place => (
            <PlaceGroup
              key={place.key}
              place={place}
              here={place.key === here}
              busy={busyKey === place.key}
              stoppable={liveKeys.has(place.key)}
              threads={threadsOf.get(place.key) ?? NO_THREADS}
              openThreadIds={place.key === here ? openThreadIds : EMPTY_THREADS}
              onOpen={goToPlace}
              onOpenThread={goToThread}
              onStop={stop}
              onForget={forgetPlace}
              take={take}
              dragged={dragged}
            />
          ))}
        </div>
      </div>
      <NewPlace busy={busyKey !== null} onOpen={addPlace} />
    </aside>
  )
}
