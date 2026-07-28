import { useEffect, useState } from 'react'
import type { CrewHome } from '../../../shared/project'
import ScreenSwap from '../components/ScreenSwap'
import Tooltip from '../components/Tooltip'
import { ChevronLeftGlyph } from '../icons'
import { useCrew } from '../state/store'
import JoinLink from './home/JoinLink'
import Places from './home/Places'
import WhereTo from './home/WhereTo'
import YourName from './home/YourName'
import { placesOf, type Place } from './home/places'

type Screen = 'places' | 'name' | 'where' | 'link'

const DEPTH: Record<Screen, number> = { places: 0, name: 1, where: 1, link: 1 }

function cleanError(err: unknown): string {
  return String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export default function Home() {
  const connect = useCrew(s => s.connect)
  const [name, setName] = useState(() => localStorage.getItem('crew.name') ?? '')
  const [folder, setFolder] = useState<string | null>(() => localStorage.getItem('crew.folder'))
  const [link, setLink] = useState(() => localStorage.getItem('crew.link') ?? '')
  const [places, setPlaces] = useState<Place[]>([])
  const [screen, setScreen] = useState<Screen>(() => (localStorage.getItem('crew.name') ? 'places' : 'name'))
  const [asking, setAsking] = useState<{ folder: string; tracked: boolean } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = () => {
    void Promise.all([window.crew.projects().catch(() => []), window.crew.recentJoins().catch(() => [])]).then(
      ([projects, joins]) => setPlaces(placesOf(projects, joins))
    )
  }

  useEffect(load, [])

  const keep = (): string => {
    const trimmed = name.trim()
    localStorage.setItem('crew.name', trimmed)
    return trimmed
  }

  const open = async (target: string, key: string, opts?: { home: CrewHome }) => {
    setBusy(true)
    setBusyKey(key)
    setError('')
    try {
      const who = keep()
      localStorage.setItem('crew.folder', target)
      connect(await window.crew.start(target, who, opts))
    } catch (err) {
      setError(cleanError(err))
      setScreen('places')
    } finally {
      setBusy(false)
      setBusyKey(null)
    }
  }

  // A folder that has been opened before keeps the answer it was given, so the
  // only time anything is asked is the first time.
  const pickFolder = async () => {
    const picked = await window.crew.pickFolder()
    if (!picked) return
    setFolder(picked)
    setError('')
    const plan = await window.crew.projectPlan(picked).catch(() => null)
    if (plan?.known) return open(picked, `project:${picked}`)
    setAsking({ folder: picked, tracked: plan?.tracked ?? false })
    setScreen('where')
  }

  const joinSession = async (sessionLink: string, sessionFolder: string, key: string) => {
    setBusy(true)
    setBusyKey(key)
    setError('')
    try {
      const who = keep()
      localStorage.setItem('crew.folder', sessionFolder)
      localStorage.setItem('crew.link', sessionLink)
      connect(await window.crew.join(sessionLink, sessionFolder, who))
    } catch (err) {
      setError(cleanError(err))
      setScreen('places')
    } finally {
      setBusy(false)
      setBusyKey(null)
    }
  }

  const openPlace = async (place: Place) => {
    if (place.join) {
      setName(place.join.name)
      setLink(place.join.link)
      setFolder(place.join.folder)
      return joinSession(place.join.link, place.join.folder, place.key)
    }
    if (place.project) return open(place.project.folder, place.key)
  }

  const forget = async (place: Place) => {
    if (!place.project) return
    await window.crew.forgetProject(place.project.folder).catch(() => {})
    load()
  }

  const joinTyped = async () => {
    if (!link.trim()) return setError('Paste the link first.')
    if (!folder) return setError('Pick a folder for your agents to work in.')
    await joinSession(link.trim(), folder, 'link')
  }

  const back = () => {
    setError('')
    setAsking(null)
    setScreen('places')
  }

  const body = () => {
    if (screen === 'name') {
      return (
        <YourName
          name={name}
          first={places.length === 0 && !localStorage.getItem('crew.name')}
          onChange={setName}
          onDone={() => {
            keep()
            setScreen('places')
          }}
        />
      )
    }
    if (screen === 'where' && asking) {
      return (
        <WhereTo
          folder={asking.folder}
          tracked={asking.tracked}
          busy={busy}
          onPick={home => void open(asking.folder, `project:${asking.folder}`, { home })}
        />
      )
    }
    if (screen === 'link') {
      return (
        <JoinLink
          link={link}
          folder={folder}
          busy={busy}
          onLink={setLink}
          onPickFolder={async () => {
            const picked = await window.crew.pickFolder()
            if (picked) setFolder(picked)
          }}
          onJoin={() => void joinTyped()}
        />
      )
    }
    return (
      <Places
        name={name}
        places={places}
        busy={busy}
        busyKey={busyKey}
        onOpen={place => void openPlace(place)}
        onForget={place => void forget(place)}
        onPick={() => void pickFolder()}
        onJoin={() => {
          setError('')
          setScreen('link')
        }}
        onName={() => setScreen('name')}
      />
    )
  }

  return (
    <div className="relative h-full overflow-y-auto px-6">
      <div className="app-drag absolute top-0 inset-x-0 h-[70px]" />
      <div className="w-full max-w-sm min-h-full mx-auto py-16 flex flex-col justify-center gap-6 animate-rise">
        {screen !== 'places' && (
          <Tooltip label="Back" className="self-start">
            <button
              onClick={back}
              aria-label="Back"
              className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted transition-colors duration-150 hover:bg-ink-800 hover:text-fg active:scale-95"
            >
              <ChevronLeftGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
        <ScreenSwap screen={screen} depth={DEPTH[screen]}>
          {body()}
        </ScreenSwap>
        {error && <p className="text-sm text-danger animate-pop">{error}</p>}
      </div>
    </div>
  )
}
