import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { projectPlace } from '../../../shared/places'
import type { CrewHome } from '../../../shared/project'
import { said } from '../api/said'
import { playSound, type SoundName } from '../media/sounds'
import { usePlaces } from '../state/places'
import { usePrefs } from '../state/prefs'
import { SIDEBAR_W, useSidebar } from '../state/sidebar'
import { useCrew } from '../state/store'
import { toast } from '../state/toast'
import type { Place } from '../views/home/place'
import { createDocPage } from './doc/docsPages'
import { TABS, TAB_ICON, type Tab } from './navTabs'
import NavRow from './sidebar/NavRow'
import NewChat from './sidebar/NewChat'
import NewPage from './sidebar/NewPage'
import NewPlace from './sidebar/NewPlace'
import PlaceFace from './sidebar/PlaceFace'
import PlaceGroup from './sidebar/PlaceGroup'
import SidebarDocs from './sidebar/SidebarDocs'
import SidebarMore from './sidebar/SidebarMore'
import SidebarPinnedItem from './sidebar/SidebarPinnedItem'
import SidebarTasks from './sidebar/SidebarTasks'
import { useDocsMenu } from './sidebar/docsMenu'
import { SIDEBAR_ITEMS } from './sidebar/sidebarItems'
import { NO_THREADS } from './sidebar/placeItems'
import { useReorder } from './useReorder'
import { useScrollFade } from './useScrollFade'
import { useSidebarPins } from '../state/sidebarPins'

const EMPTY_THREADS: string[] = []
const TAB_SOUND: Record<Tab, SoundName> = {
  chat: 'tab.chat',
  docs: 'tab.docs',
  design: 'tab.design',
  plugins: 'tab.plugins',
  scheduled: 'tab.scheduled',
  mail: 'tab.docs'
}

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
  const rename = usePlaces(s => s.rename)
  const here = useCrew(s => s.place)
  const openThreadIds = useCrew(s => s.openThreadIds)
  const name = useCrew(s => s.selfName)
  const switchTo = useCrew(s => s.switchTo)
  const closePlace = useCrew(s => s.closePlace)
  const peek = useSidebar(s => s.peek)
  const glass = usePrefs().glassSidebar
  const sidebarPins = useSidebarPins()
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
      if (place.key === here || usePlaces.getState().live.some(one => one.key === place.key)) {
        await switchTo(place.key)
        return true
      }
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

  // The project itself is the way back to the project, so pressing it lands on
  // the chat rather than on whatever thread was open in it.
  const goToPlace = useCallback(
    (place: Place) => {
      useCrew.getState().wantThread(null)
      void go(place)
    },
    [go]
  )

  const openPlaceWindow = useCallback((place: Place) => {
    void window.crew.openProjectWindow(place.key).catch(err => {
      toast.fail(said(err), { key: 'open-place-window' })
    })
  }, [])

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
      if (next !== tab) playSound(TAB_SOUND[next])
      onTab(next)
    },
    [onTab, peek, tab]
  )

  const newPage = useCallback(() => {
    goToTab('docs')
    createDocPage('')
  }, [goToTab])

  const newScopedPage = useCallback(
    (scope?: 'private' | 'ghost') => {
      goToTab('docs')
      createDocPage('', scope)
    },
    [goToTab]
  )
  const docsMenu = useDocsMenu(newScopedPage)

  const newChat = useCallback(() => {
    void window.crew.openPersonalChat(name).catch(err => {
      toast.fail(said(err), { key: 'open-personal-chat' })
    })
  }, [name])

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

  const renamePlace = useCallback((place: Place, name: string) => void rename(place.key, name), [rename])

  const addPlace = useCallback(
    (folder: string, home?: CrewHome) => void open(folder, projectPlace(folder), home),
    [open]
  )

  return (
    <aside
      style={{ width: SIDEBAR_W }}
      className={`h-full flex flex-col ${
        glass && overlay
          ? `glass sidebar-glass rounded-r-card ${strong ? 'glass-strong' : ''}`
          : glass
            ? 'sidebar-pinned bg-ink-800 border-r border-[var(--glass-line)]'
            : `bg-ink-900 border-r border-ink-700 ${overlay ? 'rounded-r-card' : ''}`
      }`}
    >
      <div className="app-drag h-[70px] shrink-0" />
      <div
        ref={node => {
          scroller.current = node
          order.ref(node)
        }}
        className="scroll-fade relative flex-1 min-h-0 overflow-y-auto app-no-drag px-2 pb-3"
      >
        <nav aria-label="Main navigation" className="flex flex-col gap-0.5">
          {TABS.map(one => (
            <div key={one.id} className="contents">
              <NavRow
                icon={<one.Icon className={TAB_ICON} />}
                label={one.label}
                lit={tab === one.id && one.id !== 'docs'}
                current={tab === one.id}
                expanded={one.id === 'docs' ? tab === 'docs' : undefined}
                menu={one.id === 'docs'}
                after={
                  one.id === 'chat' ? (
                    <NewChat onClick={newChat} />
                  ) : one.id === 'docs' ? (
                    <NewPage onClick={newPage} />
                  ) : undefined
                }
                onClick={() => goToTab(one.id)}
                onContextMenu={one.id === 'docs' ? docsMenu.onContextMenu : undefined}
              />
              {one.id === 'docs' && <SidebarDocs open={tab === 'docs'} />}
            </div>
          ))}
          <SidebarTasks />
          {SIDEBAR_ITEMS.filter(item => sidebarPins.includes(item.id)).map(item => (
            <SidebarPinnedItem key={item.id} item={item} tab={tab} onTab={goToTab} />
          ))}
          <SidebarMore tab={tab} onTab={goToTab} />
        </nav>
        {docsMenu.menu}
        <div className="group pl-2 pt-5 pb-2.5 flex items-center justify-between">
          <h2 className="text-xs font-medium text-fg/45">Projects</h2>
          <NewPlace busy={busyKey !== null} onOpen={addPlace} />
        </div>
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
              onOpenWindow={openPlaceWindow}
              onOpenThread={goToThread}
              onStop={stop}
              onRename={renamePlace}
              onForget={forgetPlace}
              take={take}
              dragged={dragged}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}
