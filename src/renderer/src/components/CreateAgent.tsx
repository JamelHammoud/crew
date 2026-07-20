import { PlusIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useState } from 'react'
import type { AgentSettings, ProviderCapability } from '../../../shared/llm'
import { resolveSettings } from '../../../shared/llm'
import Select from './Select'
import Spinner from './Spinner'

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
    return <p className="text-sm text-fg-muted">No LLM CLIs found on this machine.</p>
  }

  return (
    <>
      <button
        onClick={start}
        disabled={!caps}
        className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-ink-800 text-sm font-semibold text-fg-secondary transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95 disabled:opacity-50"
      >
        <PlusIcon className="w-4 h-4" />
        Add agent
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="glass relative w-full max-w-md rounded-card p-6 space-y-5 animate-pop">
        <h3 className="text-base font-semibold text-fg">Add an agent</h3>
        <div className="flex flex-wrap gap-2">
          <Select
            label="Provider"
            value={provider}
            options={(caps ?? []).map(c => ({ value: c.provider, label: c.label }))}
            onChange={selectProvider}
          />
          {cap?.fields.map(field => (
            <Select
              key={field.key}
              label={field.label}
              value={settings[field.key] ?? field.default}
              options={field.options}
              onChange={value => setSetting(field.key, value)}
            />
          ))}
        </div>
        <input
          value={name}
          onChange={e => {
            setName(e.target.value)
            setNameEdited(true)
          }}
          placeholder="Agent name"
          className="w-full bg-ink-850 border border-ink-700 rounded-xl px-4 py-2.5 text-base text-fg placeholder:text-fg-muted outline-none transition-colors focus:border-ink-500"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="h-10 px-4 rounded-full text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={busy || !name.trim()}
            className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-2 transition-all duration-150 hover:scale-[1.03] active:scale-95 disabled:bg-white/10 disabled:text-fg-muted disabled:scale-100"
          >
            {busy && <Spinner size={14} />}
            Create
          </button>
        </div>
      </div>
        </div>
      )}
    </>
  )
}
