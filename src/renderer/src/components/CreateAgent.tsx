import { useEffect, useMemo, useState } from 'react'
import type { AgentSettings, ProviderCapability } from '../../../shared/llm'
import { resolveSettings } from '../../../shared/llm'

function titleCase(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value
}

function defaultName(cap: ProviderCapability, settings: AgentSettings): string {
  const model = settings['model']
  if (!model) return cap.label
  const field = cap.fields.find(f => f.key === 'model')
  const label = field?.options.find(o => o.value === model)?.label ?? model
  return `${cap.label} ${titleCase(label)}`
}

export default function CreateAgent() {
  const [caps, setCaps] = useState<ProviderCapability[] | null>(null)
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState('')
  const [settings, setSettings] = useState<AgentSettings>({})
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void window.crew.agentCapabilities().then(setCaps)
  }, [])

  const cap = useMemo(() => caps?.find(c => c.provider === provider) ?? null, [caps, provider])

  const selectProvider = (next: string, list = caps) => {
    const chosen = list?.find(c => c.provider === next) ?? null
    setProvider(next)
    const resolved = chosen ? resolveSettings(chosen.fields, {}) : {}
    setSettings(resolved)
    setNameEdited(false)
    setName(chosen ? defaultName(chosen, resolved) : '')
  }

  const start = () => {
    if (!caps || caps.length === 0) return
    setError('')
    selectProvider(caps[0].provider)
    setOpen(true)
  }

  const setSetting = (key: string, value: string) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    if (!nameEdited && cap) setName(defaultName(cap, next))
  }

  const create = async () => {
    if (!cap || !name.trim()) return
    setBusy(true)
    setError('')
    try {
      await window.crew.createAgent({ provider: cap.provider, name: name.trim(), settings })
      setOpen(false)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setBusy(false)
    }
  }

  if (caps && caps.length === 0) {
    return <p className="text-xs text-zinc-500">No LLM CLIs found on this machine.</p>
  }

  if (!open) {
    return (
      <button
        onClick={start}
        disabled={!caps}
        className="text-xs px-3 py-1.5 rounded-md border border-zinc-700 text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
      >
        Add agent
      </button>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1.5 text-xs text-zinc-500">
          Provider
          <select
            value={provider}
            onChange={e => selectProvider(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-300 outline-none focus:border-zinc-700"
          >
            {caps?.map(c => (
              <option key={c.provider} value={c.provider}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {cap?.fields.map(field => (
          <label key={field.key} className="flex items-center gap-1.5 text-xs text-zinc-500">
            {field.label}
            <select
              value={settings[field.key] ?? field.default}
              onChange={e => setSetting(field.key, e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-300 outline-none focus:border-zinc-700"
            >
              {field.options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input
          value={name}
          onChange={e => {
            setName(e.target.value)
            setNameEdited(true)
          }}
          placeholder="Agent name"
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
        />
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="bg-white text-black rounded-lg px-4 py-2 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 shrink-0"
        >
          Create
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-zinc-400 hover:text-zinc-200 shrink-0">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
