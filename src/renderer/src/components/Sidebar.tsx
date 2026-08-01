import { useEffect, useState } from 'react'
import { projectPlace } from '../../../shared/places'
import type { CrewHome } from '../../../shared/project'
import { PlusGlyph } from '../icons'
import { isLive, threadsIn, usePlaces } from '../state/places'
import { SIDEBAR_W, useSidebar } from '../state/sidebar'
import { useCrew } from '../state/store'
import { toast } from '../state/toast'
import WhereTo from '../views/home/WhereTo'
import type { Place } from '../views/home/place'
import Modal from './Modal'
import PlaceGroup from './sidebar/PlaceGroup'

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
  const here = useCrew(s => s.place)
  const openThreadIds = useCrew(s => s.openThreadIds)
  const name = useCrew(s => s.selfName)
  const switchTo = useCrew(s => s.switchTo)
  const closePlace = useCrew(s => s.closePlace)
  const peek = useSidebar(s => s.peek)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [asking, setAsking] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  const open = async (folder: string, key: string, home?: CrewHome) => {
    setBusyKey(key)
    try {
      useCrew.getState().connect(await window.crew.start(folder, name, home ? { home } : undefined))
    } catch (err) {
      toast.fail(said(err), { key: 'open-place' })
    } finally {
      setBusyKey(null)
    }
  }

  const go = async (place: Place): Promise<boolean> => {
    if (busyKey) return false
    if (place.key === here) return true
    peek(false)
    if (isLive(live, place.key)) {
      await switchTo(place.key)
      return true
    }
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
  }

  const goToThread = async (place: Place, threadId: string, toRight = false) => {
    useCrew.getState().wantThread(threadId)
    if (place.key === here) {
      if (toRight) useCrew.getState().openThread(threadId)
      else useCrew.getState().openThreadAlone(threadId)
    }
    else await go(place)
  }

  const forget = async (place: Place) => {
    if (place.project) await window.crew.forgetProject(place.project.folder).catch(() => {})
    if (place.join) await window.crew.forgetJoin(place.join.link).catch(() => {})
    await load()
  }

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
          ? `glass rounded-r-card ${strong ? 'glass-strong' : ''}`
          : 'bg-ink-800 mac:bg-[var(--glass-bg)] border-r border-[var(--glass-line)]'
      }`}
    >
      <div className="app-drag h-[70px] shrink-0" />
      <div className="app-no-drag shrink-0 px-4 pb-2">
        <span className="text-xs font-medium text-fg/40">Projects</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto app-no-drag px-3 pb-2">
        {places.map(place => (
          <PlaceGroup
            key={place.key}
            place={place}
            here={place.key === here}
            busy={busyKey === place.key}
            threads={threadsIn(live, place.key)}
            openThreadIds={place.key === here ? openThreadIds : EMPTY_THREADS}
            onOpen={() => {
              useCrew.getState().wantThread(null)
              void go(place)
            }}
            onOpenThread={threadId => void goToThread(place, threadId)}
            onOpenThreadToRight={threadId => void goToThread(place, threadId, true)}
            onStop={isLive(live, place.key) ? () => void closePlace(place.key) : undefined}
            onForget={() => void forget(place)}
          />
        ))}
      </div>
      <div className="app-no-drag shrink-0 border-t border-fg/[0.05] px-3 py-2.5">
        <button
          onClick={() => void pick()}
          className="w-full h-9 rounded-xl px-2 flex items-center gap-2.5 text-sm font-medium text-fg/60 transition-colors duration-150 hover:bg-fg/[0.06] hover:text-fg active:scale-[0.98]"
        >
          <span className="w-6 h-6 rounded-lg border border-fg/[0.08] bg-fg/[0.03] grid place-items-center text-fg/55">
            <PlusGlyph className="w-3.5 h-3.5" />
          </span>
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
