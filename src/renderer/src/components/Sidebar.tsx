import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { projectPlace } from '../../../shared/places'
import type { CrewHome } from '../../../shared/project'
import { PlusGlyph } from '../icons'
import { usePlaces } from '../state/places'
import { SIDEBAR_W, useSidebar } from '../state/sidebar'
import { useCrew } from '../state/store'
import { toast } from '../state/toast'
import WhereTo from '../views/home/WhereTo'
import type { Place } from '../views/home/place'
import Modal from './Modal'
import PlaceGroup from './sidebar/PlaceGroup'
import { NO_THREADS } from './sidebar/placeItems'
import { useReorder } from './useReorder'

function said(err: unknown): string {
  return String(err instanceof Error ? err.message : err).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ''
  )
}

const EMPTY_THREADS: string[] = []

export default function Sidebar({ overlay, strong }: { overlay?: boolean; strong?: boolean }) {
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
  const [asking, setAsking] = useState<string | null>(null)
  const order = useReorder((key, to) => move(key, to), 'vertical')

  const held = useRef(order)
  held.current = order
  const take = useCallback((key: string) => held.current.take(key), [])
  const dragged = useCallback(() => held.current.dragged(), [])

  const threadsOf = useMemo(() => new Map(live.map(place => [place.key, place.threads])), [live])
  const liveKeys = useMemo(() => new Set(live.map(place => place.key)), [live])

  useEffect(() => {
    void load()
  }, [load])

  const open = useCallback(
    async (folder: string, key: string, home?: CrewHome) => {
      setBusyKey(key)
      try {
        useCrew.getState().connect(await window.crew.start(folder, name, home ? { home } : undefined))
      } catch (err) {
        toast.fail(said(err), { key: 'open-place' })
      } finally {
        setBusyKey(null)
      }
    },
    [name]
  )

  const go = useCallback(
    async (place: Place): Promise<boolean> => {
      if (busyKey) return false
      peek(false)
      if (liveKeys.has(place.key)) {
        await switchTo(place.key)
        return true
      }
      if (place.key === here) return true
      if (place.join) {
        setBusyKey(place.key)
        try {
          useCrew.getState().connect(await window.crew.join(place.join.link, place.join.folder, place.join.name))
          return true
        } catch (err) {
          toast.fail(said(err), { key: 'open-place' })
          return false
        } finally {
          setBusyKey(null)
        }
      }
      if (!place.project) return false
      await open(place.project.folder, place.key)
      return true
    },
    [busyKey, here, liveKeys, open, peek, switchTo]
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

  const pick = async () => {
    const folder = await window.crew.pickFolder()
    if (!folder) return
    peek(false)
    const plan = await window.crew.projectPlan(folder).catch(() => null)
    if (plan?.known) return open(folder, projectPlace(folder))
    setAsking(folder)
  }

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
      <div ref={order.ref} className="flex-1 min-h-0 overflow-y-auto app-no-drag px-2 pt-1">
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
      <div className="app-no-drag shrink-0 px-2 pt-2 pb-5">
        <button
          onClick={() => void pick()}
          className="w-full h-9 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-fg/70 transition-colors duration-150 hover:bg-fg/[0.06] hover:text-fg active:scale-[0.98]"
        >
          <PlusGlyph className="w-4 h-4" />
          Open a folder
        </button>
      </div>
      <Modal open={asking !== null} onClose={() => setAsking(null)} title="" width={520} flush>
        <div className="p-6">
          <WhereTo
            busy={busyKey !== null}
            onPick={home => {
              const folder = asking
              setAsking(null)
              if (folder) void open(folder, projectPlace(folder), home)
            }}
          />
        </div>
      </Modal>
    </aside>
  )
}
