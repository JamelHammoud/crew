import { useState } from 'react'
import { parseLink } from '../../../shared/link'
import { useCrew } from '../state/store'

function cleanError(err: unknown): string {
  return String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export default function Home() {
  const connect = useCrew(s => s.connect)
  const [name, setName] = useState(() => localStorage.getItem('crew.name') ?? '')
  const [folder, setFolder] = useState<string | null>(null)
  const [link, setLink] = useState('')
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
      const info = await window.crew.join(link.trim(), folder!, name.trim())
      connect(info.wsUrl, name.trim(), parseLink(link.trim()).code)
    } catch (err) {
      setError(cleanError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">crew</h1>
          <p className="text-sm text-zinc-400 mt-1">Pool your LLMs with friends and build together.</p>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Your name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Bobert"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Project folder</label>
            <button
              onClick={pickFolder}
              className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500 truncate"
            >
              {folder ?? 'Choose a folder tracked with git'}
            </button>
          </div>
          <button
            onClick={start}
            disabled={busy}
            className="w-full bg-white text-black rounded-lg px-3 py-2 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
          >
            Start a session
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <div className="h-px bg-zinc-800 flex-1" />
          or
          <div className="h-px bg-zinc-800 flex-1" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Invite link</label>
            <input
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="crew://100.64.1.2:4767/a1b2c3"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
            />
          </div>
          <button
            onClick={join}
            disabled={busy}
            className="w-full bg-transparent border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm font-medium hover:border-zinc-400 disabled:opacity-50"
          >
            Join a session
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  )
}
