import { useEffect } from 'react'
import { DesktopGlyph, FolderGlyph, GlobeGlyph, PlusGlyph } from '../icons'
import { isLive, usePlaces } from '../state/places'
import { SIDEBAR_W, useSidebar } from '../state/sidebar'
import { useCrew } from '../state/store'
import { toast } from '../state/toast'
import PlaceRow from '../views/home/PlaceRow'
import type { Place } from '../views/home/place'

function mark(place: Place) {
  if (place.join) return <GlobeGlyph className="w-4 h-4 text-fg-secondary" />
  if (place.project?.home === 'private') return <DesktopGlyph className="w-4 h-4 text-fg-secondary" />
  return <FolderGlyph className="w-4 h-4 text-fg-secondary" />
}

export default function Sidebar() {
  const places = usePlaces(s => s.places)
  const live = usePlaces(s => s.live)
  const load = usePlaces(s => s.load)
  const here = useCrew(s => s.place)
  const switchTo = useCrew(s => s.switchTo)
  const closePlace = useCrew(s => s.closePlace)
  const peek = useSidebar(s => s.peek)

  useEffect(() => {
    void load()
  }, [load])

  const go = async (place: Place) => {
    if (place.key === here) return
    peek(false)
    if (isLive(live, place.key)) {
      await switchTo(place.key)
      return
    }
    if (place.join) {
      await window.crew.join(place.join.link, place.join.folder, place.join.name).then(useCrew.getState().connect)
      return
    }
    if (!place.project) return
    const opened = await window.crew
      .start(place.project.folder, useCrew.getState().selfName)
      .catch(() => null)
    if (!opened) {
      toast.fail(`${place.title} would not open.`, { key: 'open-place' })
      return
    }
    useCrew.getState().connect(opened)
  }

  return (
    <aside
      style={{ width: SIDEBAR_W }}
      className="h-full flex flex-col bg-ink-800/40 border-r border-ink-700"
    >
      <div className="app-drag h-[70px] shrink-0 mac:pl-[64px]" />
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        {places.map(place => (
          <PlaceRow
            key={place.key}
            mark={mark(place)}
            title={place.title}
            line={place.line}
            here={place.key === here}
            live={isLive(live, place.key)}
            onOpen={() => void go(place)}
            onClose={isLive(live, place.key) ? () => void closePlace(place.key) : undefined}
            onForget={() => void forget(place, load)}
          />
        ))}
      </div>
      <div className="app-no-drag shrink-0 p-2 border-t border-ink-700">
        <button
          onClick={() => void openFolder()}
          className="w-full h-10 rounded-full flex items-center justify-center gap-2 text-sm font-medium text-fg-secondary transition-colors duration-150 hover:bg-ink-700 hover:text-fg active:scale-[0.98]"
        >
          <PlusGlyph className="w-4 h-4" />
          Open a folder
        </button>
      </div>
    </aside>
  )
}

async function forget(place: Place, load: () => Promise<void>): Promise<void> {
  if (place.project) await window.crew.forgetProject(place.project.folder).catch(() => {})
  if (place.join) await window.crew.forgetJoin(place.join.link).catch(() => {})
  await load()
}

async function openFolder(): Promise<void> {
  const picked = await window.crew.pickFolder()
  if (!picked) return
  const plan = await window.crew.projectPlan(picked).catch(() => null)
  if (!plan?.known) {
    toast('Open it from the list to say where its crew should live.', { key: 'open-place' })
    return
  }
  const opened = await window.crew.start(picked, useCrew.getState().selfName).catch(() => null)
  if (!opened) {
    toast.fail('That folder would not open.', { key: 'open-place' })
    return
  }
  useCrew.getState().connect(opened)
}
