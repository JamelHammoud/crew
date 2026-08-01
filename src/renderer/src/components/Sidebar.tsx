import { useEffect, useState } from 'react'
import { projectPlace } from '../../../shared/places'
import type { CrewHome } from '../../../shared/project'
import { DesktopGlyph, FolderGlyph, GlobeGlyph, PlusGlyph } from '../icons'
import { isLive, usePlaces } from '../state/places'
import { SIDEBAR_W, useSidebar } from '../state/sidebar'
import { useCrew } from '../state/store'
import { toast } from '../state/toast'
import PlaceRow from '../views/home/PlaceRow'
import WhereTo from '../views/home/WhereTo'
import type { Place } from '../views/home/place'
import Modal from './Modal'

function markOf(place: Place) {
  if (place.join) return <GlobeGlyph className="w-4 h-4 text-fg-secondary" />
  if (place.project?.home === 'private') return <DesktopGlyph className="w-4 h-4 text-fg-secondary" />
  return <FolderGlyph className="w-4 h-4 text-fg-secondary" />
}

function said(err: unknown): string {
  return String(err instanceof Error ? err.message : err).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ''
  )
}

export default function Sidebar() {
  const places = usePlaces(s => s.places)
  const live = usePlaces(s => s.live)
  const load = usePlaces(s => s.load)
  const here = useCrew(s => s.place)
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

  const go = async (place: Place) => {
    if (place.key === here || busyKey) return
    peek(false)
    if (isLive(live, place.key)) return switchTo(place.key)
    if (place.join) {
      setBusyKey(place.key)
      try {
        useCrew
          .getState()
          .connect(await window.crew.join(place.join.link, place.join.folder, place.join.name))
      } catch (err) {
        toast.fail(said(err), { key: 'open-place' })
      } finally {
        setBusyKey(null)
      }
      return
    }
    if (place.project) await open(place.project.folder, place.key)
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
    <aside style={{ width: SIDEBAR_W }} className="h-full flex flex-col bg-ink-800/50">
      <div className="app-drag h-[70px] shrink-0" />
      <div className="flex-1 min-h-0 overflow-y-auto app-no-drag px-2 pb-2">
        {places.map(place => (
          <PlaceRow
            key={place.key}
            mark={markOf(place)}
            title={place.title}
            line={place.line}
            here={place.key === here}
            live={isLive(live, place.key)}
            busy={busyKey === place.key}
            disabled={busyKey !== null && busyKey !== place.key}
            onOpen={() => void go(place)}
            onClose={isLive(live, place.key) ? () => void closePlace(place.key) : undefined}
            onForget={() => void forget(place)}
          />
        ))}
      </div>
      <div className="app-no-drag shrink-0 p-2">
        <button
          onClick={() => void pick()}
          className="w-full h-10 rounded-full flex items-center justify-center gap-2 text-sm font-medium text-fg-secondary transition-colors duration-150 hover:bg-ink-700 hover:text-fg active:scale-[0.98]"
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
