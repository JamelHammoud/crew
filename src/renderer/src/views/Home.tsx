import { ArrowRightIcon, ClockIcon, FolderIcon } from '@heroicons/react/20/solid'
import { useEffect, useState } from 'react'
import { parseLink } from '../../../shared/link'
import type { RecentJoin } from '../../../shared/recent'
import Spinner from '../components/Spinner'
import { useCrew } from '../state/store'

function cleanError(err: unknown): string {
  return String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

const FIELD =
  'w-full bg-ink-800 rounded-2xl px-4 py-3 text-base text-fg placeholder:text-fg-muted outline-none transition-shadow duration-200 focus:shadow-[0_0_0_1px_rgb(255_255_255/0.12)] light:focus:shadow-[0_0_0_1px_rgb(0_0_0/0.14)]'

function folderName(folder: string): string {
  return folder.split(/[\\/]/).filter(Boolean).at(-1) ?? folder
}

function serverName(link: string): string {
  try {
    const target = parseLink(link)
    return `${target.host}:${target.port}`
  } catch {
    return link
  }
}

export default function Home() {
  const connect = useCrew(s => s.connect)
  const [name, setName] = useState(() => localStorage.getItem('crew.name') ?? '')
  const [folder, setFolder] = useState<string | null>(() => localStorage.getItem('crew.folder'))
  const [link, setLink] = useState(() => localStorage.getItem('crew.link') ?? '')
  const [recentJoins, setRecentJoins] = useState<RecentJoin[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyLink, setBusyLink] = useState<string | null>(null)

  useEffect(() => {
    void window.crew
      .recentJoins()
      .then(setRecentJoins)
      .catch(() => setRecentJoins([]))
  }, [])

  const pickFolder = async () => {
    const picked = await window.crew.pickFolder()
    if (picked) setFolder(picked)
  }

  const guard = (): string | null => {
    if (!name.trim()) return 'Add your name first.'
    if (!folder) return 'Pick a project folder first.'
    return null
  }

  const start = async () => {
    const problem = guard()
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    try {
      localStorage.setItem('crew.name', name.trim())
      localStorage.setItem('crew.folder', folder!)
      const info = await window.crew.start(folder!, name.trim())
      connect(info.wsUrl, name.trim(), parseLink(info.link).code, info.link)
    } catch (err) {
      setError(cleanError(err))
    } finally {
      setBusy(false)
    }
  }

  const joinSession = async (sessionLink: string, sessionFolder: string, sessionName: string) => {
    setBusy(true)
    setBusyLink(sessionLink)
    setError('')
    try {
      localStorage.setItem('crew.name', sessionName)
      localStorage.setItem('crew.folder', sessionFolder)
      localStorage.setItem('crew.link', sessionLink)
      const info = await window.crew.join(sessionLink, sessionFolder, sessionName)
      connect(info.wsUrl, sessionName, parseLink(sessionLink).code)
    } catch (err) {
      setError(cleanError(err))
    } finally {
      setBusy(false)
      setBusyLink(null)
    }
  }

  const join = async () => {
    const problem = guard()
    if (problem) return setError(problem)
    if (!link.trim()) return setError('Paste the invite link first.')
    await joinSession(link.trim(), folder!, name.trim())
  }

  const joinRecent = async (recent: RecentJoin) => {
    setName(recent.name)
    setFolder(recent.folder)
    setLink(recent.link)
    await joinSession(recent.link, recent.folder, recent.name)
  }

  return (
    <div className="relative h-full overflow-y-auto px-6">
      <div className="app-drag absolute top-0 inset-x-0 h-[70px]" />
      <div className="w-full max-w-sm min-h-full mx-auto py-16 flex flex-col justify-center gap-8 animate-rise">
        <div>
          <h1 className="font-mono font-semibold text-3xl text-fg select-none">crew</h1>
          <p className="text-base text-fg-muted mt-2">Pool your LLMs with friends and build together.</p>
        </div>

        {recentJoins.length > 0 && (
          <section aria-label="Recently joined" className="space-y-2">
            <p className="text-sm text-fg-muted">Recently joined</p>
            <div className="rounded-card bg-ink-800 p-1.5">
              {recentJoins.map(recent => (
                <button
                  key={recent.link}
                  onClick={() => void joinRecent(recent)}
                  disabled={busy}
                  className="group w-full rounded-2xl px-3 py-2.5 flex items-center gap-3 text-left transition-all duration-150 hover:bg-ink-700 active:scale-[0.99] disabled:opacity-50 disabled:scale-100"
                >
                  <span className="w-9 h-9 rounded-full bg-ink-700 flex items-center justify-center shrink-0 group-hover:bg-ink-600">
                    <ClockIcon className="w-4 h-4 text-fg-secondary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg truncate">{serverName(recent.link)}</span>
                    <span className="block text-xs text-fg-muted truncate">{folderName(recent.folder)}</span>
                  </span>
                  {busyLink === recent.link ? (
                    <Spinner size={15} className="text-fg-muted" />
                  ) : (
                    <ArrowRightIcon className="w-4 h-4 text-fg-faint group-hover:text-fg-secondary group-hover:translate-x-0.5 transition-all duration-150" />
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        <div>
          <label className="block text-sm text-fg-muted mb-2">Your name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Bobert" className={FIELD} />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-fg-muted mb-2">Project folder</label>
            <button onClick={pickFolder} className={`${FIELD} flex items-center gap-2.5 text-left hover:bg-ink-700`}>
              <FolderIcon className="w-5 h-5 text-fg-muted shrink-0" />
              <span className={`truncate ${folder ? 'text-fg' : 'text-fg-muted'}`}>
                {folder ?? 'Choose a folder tracked with git'}
              </span>
            </button>
          </div>
          <button
            onClick={start}
            disabled={busy}
            className="w-full h-12 rounded-full bg-fg text-ink-900 text-base font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
          >
            {busy && <Spinner size={16} />}
            Start a session
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm text-fg-faint">
          <div className="h-px bg-ink-700 flex-1" />
          or
          <div className="h-px bg-ink-700 flex-1" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-fg-muted mb-2">Invite link</label>
            <input
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="crew://100.64.1.2:2739/a1b2c3"
              className={FIELD}
            />
          </div>
          <button
            onClick={join}
            disabled={busy}
            className="w-full h-12 rounded-full border border-ink-600 text-fg text-base font-semibold transition-all duration-150 hover:border-ink-500 hover:bg-fg/[0.03] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
          >
            Join a session
          </button>
        </div>

        {error && <p className="text-sm text-danger animate-pop">{error}</p>}
      </div>
    </div>
  )
}
