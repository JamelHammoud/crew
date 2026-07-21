import { FolderIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { parseLink } from '../../../shared/link'
import Spinner from '../components/Spinner'
import { useCrew } from '../state/store'

function cleanError(err: unknown): string {
  return String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

const FIELD =
  'w-full bg-ink-800 rounded-2xl px-4 py-3 text-base text-fg placeholder:text-fg-muted outline-none transition-shadow duration-200 focus:shadow-[0_0_0_1px_rgb(255_255_255/0.12)]'

export default function Home() {
  const connect = useCrew(s => s.connect)
  const [name, setName] = useState(() => localStorage.getItem('crew.name') ?? '')
  const [folder, setFolder] = useState<string | null>(() => localStorage.getItem('crew.folder'))
  const [link, setLink] = useState(() => localStorage.getItem('crew.link') ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  const join = async () => {
    const problem = guard()
    if (problem) return setError(problem)
    if (!link.trim()) return setError('Paste the invite link first.')
    setBusy(true)
    setError('')
    try {
      localStorage.setItem('crew.name', name.trim())
      localStorage.setItem('crew.folder', folder!)
      localStorage.setItem('crew.link', link.trim())
      const info = await window.crew.join(link.trim(), folder!, name.trim())
      connect(info.wsUrl, name.trim(), parseLink(link.trim()).code)
    } catch (err) {
      setError(cleanError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative h-full flex items-center justify-center px-6">
      <div className="app-drag absolute top-0 inset-x-0 h-[70px]" />
      <div className="w-full max-w-sm space-y-8 animate-rise">
        <div>
          <h1 className="font-mono font-semibold text-3xl text-fg select-none">crew</h1>
          <p className="text-base text-fg-muted mt-2">Pool your LLMs with friends and build together.</p>
        </div>

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
