import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentSettings, ProviderCapability } from '../../../shared/llm'
import { resolveSettings, visibleSettingFields } from '../../../shared/llm'
import { PlusGlyph } from '../icons'
import Modal from './Modal'
import Select from './Select'
import { Action } from './settings/parts'
import Spinner from './Spinner'

function titleCase(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value
}

function defaultName(cap: ProviderCapability, settings: AgentSettings): string {
  const model = settings['model']
  if (!model) return cap.label
  const field = cap.fields.find(f => f.key === 'model')
  const label = field?.options.find(o => o.value === model)?.label ?? model
  const variantField = visibleSettingFields(cap.fields, settings).find(
    candidate => candidate.visibleWhen?.key === 'model' && candidate.visibleWhen.value === model
  )
  const variant = variantField?.options.find(option => option.value === settings[variantField.key])?.label
  if (variant) return `${cap.label} ${variant}`
  return `${cap.label} ${titleCase(label)}`
}

// The way in stands at the end of the agents rather than off in a corner of the
// page, so it is the empty state and the way in both, the way the toolbox ends
// its own row on the slot that opens the builder. Alone, it says where an agent
// comes from, since there is nothing above it to say so.
export default function CreateAgent({ alone }: { alone?: boolean }) {
  const [caps, setCaps] = useState<ProviderCapability[] | null>(null)
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState('')
  const [settings, setSettings] = useState<AgentSettings>({})
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [error, setError] = useState('')
  const providerRef = useRef('')

  useEffect(() => {
    void window.crew.agentCapabilities().then(setCaps)
  }, [])

  const cap = useMemo(() => caps?.find(c => c.provider === provider) ?? null, [caps, provider])
  const fields = useMemo(() => (cap ? visibleSettingFields(cap.fields, settings) : []), [cap, settings])

  const selectProvider = (next: string, list = caps) => {
    const chosen = list?.find(c => c.provider === next) ?? null
    setProvider(next)
    providerRef.current = next
    const resolved = chosen ? resolveSettings(chosen.fields, {}) : {}
    setSettings(resolved)
    setNameEdited(false)
    setName(chosen ? defaultName(chosen, resolved) : '')
  }

  const install = async (target: ProviderCapability) => {
    setInstalling(target.provider)
    setError('')
    try {
      const fresh = await window.crew.installProvider(target.provider)
      setCaps(fresh)
      // Fields can change once the CLI is on disk (model lists come from its
      // local config), so re-resolve if this provider is still the one shown.
      if (providerRef.current === target.provider) selectProvider(target.provider, fresh)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setInstalling(null)
    }
  }

  // Picking a provider that is missing its CLI is what kicks off the install.
  const pick = (next: string) => {
    selectProvider(next)
    const chosen = caps?.find(c => c.provider === next)
    if (chosen && !chosen.installed && chosen.installable && installing !== next) void install(chosen)
  }

  const start = () => {
    if (!caps || caps.length === 0) return
    setError('')
    selectProvider((caps.find(c => c.installed) ?? caps[0]).provider)
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

  const hintFor = (c: ProviderCapability) => {
    if (c.installed) return undefined
    if (installing === c.provider) return <Spinner size={12} />
    return c.installable ? 'Install' : 'Not installed'
  }

  if (caps && caps.length === 0) {
    return <p className="text-sm text-fg/45">No LLM CLIs found on this machine.</p>
  }

  return (
    <>
      <button
        onClick={start}
        disabled={!caps}
        className="group w-full flex items-center gap-3 px-5 py-4 rounded-card border border-fg/[0.09] text-left transition-colors duration-200 hover:border-fg/20 hover:bg-fg/[0.03] active:scale-[0.995] disabled:opacity-50"
      >
        <span className="w-10 h-10 rounded-full bg-fg/[0.07] flex items-center justify-center text-fg/70 transition-colors duration-200 group-hover:bg-fg/[0.12] group-hover:text-fg">
          <PlusGlyph className="w-[18px] h-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-base font-semibold text-fg">Add an agent</span>
          {alone && (
            <span className="block text-sm text-fg/45">
              One of your machine's LLMs, or wait for someone to bring theirs.
            </span>
          )}
        </span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add an agent" className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Select
            label="Provider"
            value={provider}
            options={(caps ?? []).map(c => ({ value: c.provider, label: c.label, hint: hintFor(c) }))}
            onChange={pick}
          />
          {fields.map(field => (
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
          className="w-full bg-fg/[0.06] border border-fg/10 rounded-xl px-4 py-2.5 text-base text-fg placeholder:text-fg/40 outline-none transition-colors focus:border-fg/30"
        />
        {installing && (
          <p className="flex items-center gap-2 text-sm text-fg/45">
            <Spinner size={14} />
            Installing the {caps?.find(c => c.provider === installing)?.label ?? installing} CLI…
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={busy || !name.trim() || !cap?.installed}
            className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-2 transition-all duration-150 hover:scale-[1.03] active:scale-95 disabled:bg-fg/10 disabled:text-fg/45 disabled:scale-100"
          >
            {busy && <Spinner size={14} />}
            Create
          </button>
        </div>
      </Modal>
    </>
  )
}
