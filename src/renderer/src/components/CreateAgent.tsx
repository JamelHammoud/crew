import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentSettings, ProviderCapability } from '../../../shared/llm'
import { resolveSettings, visibleSettingFields } from '../../../shared/llm'
import {
  serverName,
  serverProviderName,
  serverUrl,
  type ModelServer
} from '../../../shared/modelServers'
import { CloseGlyph, PlusGlyph } from '../icons'
import Modal from './Modal'
import ProviderMark from './ProviderMark'
import ScreenSwap from './ScreenSwap'
import Select from './Select'
import Spinner from './Spinner'
import TextField from './TextField'
import Tooltip from './Tooltip'

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
export default function CreateAgent({ alone, compact }: { alone?: boolean; compact?: boolean }) {
  const [caps, setCaps] = useState<ProviderCapability[] | null>(null)
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState('')
  const [settings, setSettings] = useState<AgentSettings>({})
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [screen, setScreen] = useState<'agent' | 'server'>('agent')
  const [servers, setServers] = useState<ModelServer[]>([])
  const [address, setAddress] = useState('')
  const [serverTitle, setServerTitle] = useState('')
  const [serverKey, setServerKey] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const providerRef = useRef('')

  useEffect(() => {
    if (compact) return
    void window.crew.agentCapabilities().then(setCaps)
  }, [compact])

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

  // A CLI's models change about never, and a model on this computer changes
  // the moment somebody pulls one, which they will very often be doing because
  // this card just told them they had none. So the card asks again every time
  // it opens, and what it already knows is what it opens on.
  const refresh = async () => {
    const fresh = await window.crew.agentCapabilities()
    setCaps(fresh)
    if (providerRef.current) selectProvider(providerRef.current, fresh)
  }

  const start = async () => {
    let list = caps
    const held = list !== null
    if (!list) {
      setLoading(true)
      try {
        list = await window.crew.agentCapabilities()
        setCaps(list)
      } catch (err) {
        setError(String(err instanceof Error ? err.message : err))
        return
      } finally {
        setLoading(false)
      }
    }
    if (list.length === 0) return
    setError('')
    selectProvider((list.find(c => c.installed) ?? list[0]).provider, list)
    setScreen('agent')
    setOpen(true)
    void window.crew.modelServers().then(setServers).catch(() => {})
    if (held) void refresh().catch(() => {})
  }

  const landOn = (url: string, fresh: ProviderCapability[]) => {
    setCaps(fresh)
    const chosen = fresh.find(c => c.provider === providerRef.current)
    if (!chosen) return
    const next = resolveSettings(chosen.fields, { ...settings, address: url })
    setSettings(next)
    if (!nameEdited) setName(defaultName(chosen, next))
  }

  const addServer = async () => {
    setAdding(true)
    setAddError('')
    try {
      const url = serverUrl(address) ?? address.trim()
      const fresh = await window.crew.addModelServer({ url, ...(serverKey.trim() ? { key: serverKey.trim() } : {}) })
      setServers(await window.crew.modelServers())
      landOn(url, fresh)
      setAddress('')
      setServerKey('')
      setScreen('agent')
    } catch (err) {
      setAddError(String(err instanceof Error ? err.message : err))
    } finally {
      setAdding(false)
    }
  }

  const forgetServer = async (url: string) => {
    const fresh = await window.crew.forgetModelServer(url)
    setServers(await window.crew.modelServers())
    landOn(settings['address'] === url ? '' : settings['address'] ?? '', fresh)
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
      {compact ? (
        <button
          onClick={() => void start()}
          disabled={loading}
          className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-2 transition-colors duration-150 hover:bg-fg/90 active:scale-95 disabled:opacity-50"
        >
          {loading && <Spinner size={14} />}
          Add an agent
        </button>
      ) : (
        <button
          onClick={() => void start()}
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
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={screen === 'agent' ? 'Add an agent' : 'Add a server'}
        flush
      >
        <ScreenSwap screen={screen} depth={screen === 'agent' ? 0 : 1}>
          {screen === 'agent' ? (
            <div className="p-6 space-y-5">
              <h3 className="text-base font-semibold text-fg">Add an agent</h3>
              <div className="flex flex-wrap gap-2">
                <Select
                  label="Provider"
                  value={provider}
                  options={(caps ?? []).map(c => ({
                    value: c.provider,
                    label: c.label,
                    hint: hintFor(c),
                    mark: <ProviderMark provider={c.provider} />
                  }))}
                  onChange={pick}
                />
                {fields.map(field => (
                  <Select
                    key={field.key}
                    label={field.label}
                    value={settings[field.key] ?? field.default}
                    options={field.options}
                    onChange={value => setSetting(field.key, value)}
                    add={
                      field.free
                        ? { label: `Add a ${field.label.toLowerCase()}`, onPick: () => setScreen('server') }
                        : undefined
                    }
                  />
                ))}
              </div>
              <TextField
                glass
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  setNameEdited(true)
                }}
                placeholder="Agent name"
              />
              {installing && (
                <p className="flex items-center gap-2 text-sm text-fg/45">
                  <Spinner size={14} />
                  Installing {caps?.find(c => c.provider === installing)?.label ?? installing}…
                </p>
              )}
              {!installing && cap?.note && <p className="text-sm text-fg/45">{cap.note}</p>}
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
                  disabled={busy || !name.trim() || !cap?.installed || Boolean(cap.note)}
                  className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-2 transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:bg-fg/10 disabled:text-fg/45"
                >
                  {busy && <Spinner size={14} />}
                  Create
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              <h3 className="text-base font-semibold text-fg">Add a server</h3>
              <div className="space-y-2">
                <TextField
                  glass
                  autoFocus
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && address.trim()) void addServer()
                  }}
                  placeholder="Address"
                />
                <TextField
                  glass
                  type="password"
                  value={serverKey}
                  onChange={e => setServerKey(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && address.trim()) void addServer()
                  }}
                  placeholder="Key"
                />
                <p className="text-sm text-fg/45">The key stays on this computer.</p>
              </div>
              {servers.length > 0 && (
                <div className="space-y-1">
                  {servers.map(server => (
                    <div key={server.url} className="group flex items-center gap-2 h-9">
                      <span className="flex-1 min-w-0 truncate text-sm text-fg/45">
                        {serverLabel(server.url)}
                      </span>
                      <Tooltip label="Take out">
                        <button
                          onClick={() => void forgetServer(server.url)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-fg/45 opacity-0 transition-all duration-150 hover:bg-fg/10 hover:text-fg group-hover:opacity-100 active:scale-95"
                        >
                          <CloseGlyph className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
              {addError && <p className="text-sm text-danger">{addError}</p>}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setAddError('')
                    setScreen('agent')
                  }}
                  className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void addServer()}
                  disabled={adding || !address.trim()}
                  className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-2 transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:bg-fg/10 disabled:text-fg/45"
                >
                  {adding && <Spinner size={14} />}
                  Add
                </button>
              </div>
            </div>
          )}
        </ScreenSwap>
      </Modal>
    </>
  )
}
