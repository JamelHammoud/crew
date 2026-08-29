import { useEffect, useState } from 'react'
import type { OpenRequest } from '../../../shared/cli'
import type { OpenOptions, ProjectPlan } from '../../../shared/session'
import { said } from '../api/said'
import Avatar from '../components/Avatar'
import ScreenSwap from '../components/ScreenSwap'
import Tooltip from '../components/Tooltip'
import { ChevronLeftGlyph } from '../icons'
import { usePlaces } from '../state/places'
import { useBrowser } from '../state/browser'
import { useCrew } from '../state/store'
import { useWindowName } from '../state/windowName'
import CrewAway from './home/CrewAway'
import JoinLink from './home/JoinLink'
import Places from './home/Places'
import WhereTo from './home/WhereTo'
import YourName from './home/YourName'
import { type Place } from './home/place'

type Screen = 'places' | 'name' | 'where' | 'link' | 'away'

const DEPTH: Record<Screen, number> = { places: 0, name: 1, where: 1, link: 1, away: 1 }

function fetching(plan: ProjectPlan | null): boolean {
  return Boolean(plan?.crewRemote && !plan.crewHere)
}

// A column wide enough for what the screen holds. Everything is one column of
// rows but the one question, which is two things standing beside each other.
const WIDTH: Record<Screen, string> = {
  places: 'max-w-sm',
  name: 'max-w-sm',
  where: 'max-w-lg',
  link: 'max-w-sm',
  away: 'max-w-sm'
}

export default function Home() {
  const connect = useCrew(s => s.connect)
  const [known] = useState(() => localStorage.getItem('crew.name') ?? '')
  const [name, setName] = useState(known)
  const [folder, setFolder] = useState<string | null>(() => localStorage.getItem('crew.folder'))
  const [link, setLink] = useState(() => localStorage.getItem('crew.link') ?? '')
  const places = usePlaces(s => s.places)
  const [screen, setScreen] = useState<Screen>(known ? 'places' : 'name')
  // Only the very first time is there nowhere to go back to.
  const [first, setFirst] = useState(!known)
  const [asking, setAsking] = useState<{ folder: string; file?: string; share?: boolean } | null>(null)
  const [away, setAway] = useState<{ folder: string; file?: string; share?: boolean } | null>(null)
  // What `crew` in a terminal asked for, held while a name is asked for, since
  // nothing can be opened without one.
  const [asked, setAsked] = useState<OpenRequest | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useWindowName('')

  const load = () => {
    void usePlaces.getState().load()
  }

  useEffect(load, [])

  const keep = (who: string): string => {
    localStorage.setItem('crew.name', who)
    return who
  }

  // Nothing can be opened without a name to open it under, so asking for one is
  // where an empty name leads rather than a line of red under the button.
  const missingName = (): boolean => {
    if (name.trim()) return false
    setError('')
    setScreen('name')
    return true
  }

  const open = async (
    target: string,
    key: string,
    who: string,
    opts?: OpenOptions,
    fetch = false,
    file?: string
  ) => {
    setBusy(true)
    setBusyKey(key)
    setError('')
    try {
      localStorage.setItem('crew.folder', target)
      connect(await window.crew.start(target, keep(who), opts))
      if (file) useBrowser.getState().openFile(file)
    } catch (err) {
      if (fetch) {
        setAway({ folder: target, file, share: opts?.share })
        setScreen('away')
      } else {
        setError(said(err))
        setScreen('places')
      }
    } finally {
      setBusy(false)
      setBusyKey(null)
    }
  }

  // A folder that has been opened before keeps the answer it was given, so the
  // only time anything is asked is the first time.
  const pickFolder = async () => {
    if (missingName()) return
    const picked = await window.crew.pickFolder()
    if (!picked) return
    setFolder(picked)
    setError('')
    const plan = await window.crew.projectPlan(picked).catch(() => null)
    if (plan?.known) return open(picked, `project:${picked}`, name.trim(), undefined, fetching(plan))
    setAsking({ folder: picked })
    setScreen('where')
  }

  // A folder handed over by the `crew` command opens the way a row in the list
  // does, so the one question a project is ever asked is still asked once.
  const follow = async (request: OpenRequest) => {
    const who = (request.name ?? name).trim()
    if (!who) {
      setAsked(request)
      setScreen('name')
      return
    }
    setAsked(null)
    setName(who)
    setFolder(request.folder)
    if (request.link) {
      setLink(request.link)
      return joinSession(request.link, request.folder, `join:${request.link}`, who)
    }
    const key = `project:${request.folder}`
    const plan = await window.crew.projectPlan(request.folder).catch(() => null)
    if (request.home) {
      return open(request.folder, key, who, { home: request.home, share: request.share }, fetching(plan), request.file)
    }
    if (plan?.known) return open(request.folder, key, who, { share: request.share }, fetching(plan), request.file)
    setAsking({ folder: request.folder, file: request.file, share: request.share })
    setScreen('where')
  }

  useEffect(() => {
    void window.crew?.opening?.().then(request => {
      if (request) void follow(request)
    })
  }, [])

  const joinSession = async (sessionLink: string, sessionFolder: string, key: string, who: string) => {
    setBusy(true)
    setBusyKey(key)
    setError('')
    try {
      localStorage.setItem('crew.folder', sessionFolder)
      localStorage.setItem('crew.link', sessionLink)
      connect(await window.crew.join(sessionLink, sessionFolder, keep(who)))
    } catch (err) {
      setError(said(err))
      setScreen('places')
    } finally {
      setBusy(false)
      setBusyKey(null)
    }
  }

  const openPlace = async (place: Place) => {
    if (missingName()) return
    const who = name.trim()
    if (place.join) {
      setLink(place.join.link)
      setFolder(place.join.folder)
      return joinSession(place.join.link, place.join.folder, place.key, who)
    }
    if (place.project) {
      const plan = await window.crew.projectPlan(place.project.folder).catch(() => null)
      return open(place.project.folder, place.key, who, undefined, fetching(plan))
    }
  }

  const forget = async (place: Place) => {
    if (place.project) await window.crew.forgetProject(place.project.folder).catch(() => {})
    if (place.join) await window.crew.forgetJoin(place.join.link).catch(() => {})
    load()
  }

  const joinTyped = async () => {
    if (missingName()) return
    if (!link.trim()) return setError('Paste the link first.')
    if (!folder) return setError('Pick a folder for your agents to work in.')
    await joinSession(link.trim(), folder, 'link', name.trim())
  }

  const back = () => {
    setError('')
    setAsking(null)
    setAsked(null)
    setAway(null)
    setScreen('places')
  }

  const body = () => {
    if (screen === 'name') {
      return (
        <YourName
          name={name}
          first={first}
          onChange={setName}
          onDone={() => {
            keep(name.trim())
            setFirst(false)
            setScreen('places')
            if (asked) void follow({ ...asked, name: name.trim() })
          }}
        />
      )
    }
    if (screen === 'where' && asking) {
      return (
        <WhereTo
          busy={busy}
          onPick={home =>
            void open(asking.folder, `project:${asking.folder}`, name.trim(), { home, share: asking.share }, false, asking.file)
          }
        />
      )
    }
    if (screen === 'away' && away) {
      const key = `project:${away.folder}`
      return (
        <CrewAway
          busy={busy}
          onRetry={() => void open(away.folder, key, name.trim(), { share: away.share }, true, away.file)}
          onOwn={() =>
            void open(away.folder, key, name.trim(), { home: 'private', own: true, share: away.share }, false, away.file)
          }
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
      />
    )
  }

  // The way back and who you are are the window's own corners rather than rows
  // in the column, so every screen is centred on what it is really asking.
  return (
    <div className="relative h-full overflow-y-auto px-6">
      <div className="app-drag absolute top-0 inset-x-0 h-[70px] z-10 flex items-center justify-between px-6">
        <span className="mac:pl-[64px] flex items-center">
          {screen !== 'places' && !(screen === 'name' && first) && (
            <Tooltip label="Back">
              <button
                onClick={back}
                aria-label="Back"
                className="app-no-drag w-8 h-8 rounded-full flex items-center justify-center text-fg-muted transition-colors duration-150 hover:bg-ink-800 hover:text-fg active:scale-95"
              >
                <ChevronLeftGlyph className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
        </span>
        {screen === 'places' && name.trim() && (
          <Tooltip label={name}>
            <button
              onClick={() => setScreen('name')}
              aria-label="Your name"
              className="app-no-drag rounded-full transition-transform duration-150 active:scale-95"
            >
              <Avatar name={name} size="sm" />
            </button>
          </Tooltip>
        )}
      </div>
      <div
        className={`w-full ${WIDTH[screen]} min-h-full mx-auto py-20 flex flex-col justify-center transition-[max-width] duration-200 ease-out`}
      >
        <div className="flex flex-col gap-6 animate-rise">
          <ScreenSwap screen={screen} depth={DEPTH[screen]}>
            {body()}
          </ScreenSwap>
          {error && <p className="text-sm text-danger animate-pop">{error}</p>}
        </div>
      </div>
    </div>
  )
}
