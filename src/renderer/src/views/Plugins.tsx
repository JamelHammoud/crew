import { useMemo, useState } from 'react'
import {
  installPlugin,
  PLUGIN_GROUPS,
  PLUGIN_OFFERS,
  pluginKey,
  resolvePlugin,
  resolvePlugins,
  type PluginReference
} from '../../../shared/plugins'
import AddPlugin from '../components/plugins/AddPlugin'
import PluginRow from '../components/plugins/PluginRow'
import { SearchGlyph } from '../icons'
import { useCrew } from '../state/store'
import { runPluginAction } from '../state/pluginState'
import {
  connectPlugin,
  forgetPluginConnection,
  locallyConnected,
  usePluginConnections
} from '../state/pluginConnections'
import { toast } from '../state/toast'

const matches = (find: string, ...words: string[]): boolean =>
  !find || words.some(word => word.toLowerCase().includes(find.toLowerCase().trim()))

export default function Plugins() {
  const plugins = useCrew(s => s.plugins)
  const installInCrew = useCrew(s => s.installPlugin)
  const removePlugin = useCrew(s => s.removePlugin)
  const connectionIds = usePluginConnections(s => s.ids)
  const [find, setFind] = useState('')
  const [connecting, setConnecting] = useState('')
  const [trouble, setTrouble] = useState<Record<string, string>>({})

  const resolved = useMemo(() => resolvePlugins(plugins), [plugins])
  const connected = useMemo(
    () => new Set(resolved.filter(one => locallyConnected(one, connectionIds)).map(one => pluginKey(one.name))),
    [connectionIds, resolved]
  )
  const installed = resolved.filter(one => matches(find, one.label, one.blurb, one.name))
  const installedNames = useMemo(() => new Set(resolved.map(one => pluginKey(one.name))), [resolved])
  const offers = PLUGIN_OFFERS.filter(
    one => !installedNames.has(pluginKey(one.name)) && matches(find, one.label, one.blurb, one.name)
  )
  const grouped = PLUGIN_GROUPS.map(group => [
    group,
    offers.filter(one => one.group === group)
  ] as const)

  const connect = async (offer: PluginReference): Promise<void> => {
    const key = pluginKey(offer.name)
    const shared = plugins.find(one => pluginKey(one.name) === key)
    const plugin: PluginReference = shared ?? installPlugin(offer)
    const label = resolvePlugin(plugin).label
    setConnecting(key)
    setTrouble(current => ({ ...current, [key]: '' }))
    const result = await connectPlugin(plugin)
    if (!result.ok) {
      setTrouble(current => ({ ...current, [key]: result.message }))
      setConnecting('')
      return
    }
    if (!shared) {
      const problem = await installInCrew(plugin)
      if (problem) {
        forgetPluginConnection(plugin)
        setTrouble(current => ({ ...current, [key]: problem }))
        setConnecting('')
        return
      }
    }
    setConnecting('')
    toast.done(shared ? `${label} is connected on this computer.` : `${label} is installed.`, {
      key: `plugin:${key}`
    })
  }

  const remove = (plugin: PluginReference & { id: string }): void => {
    forgetPluginConnection(plugin)
    removePlugin(plugin.id)
  }

  return (
    <div className="h-full overflow-y-auto px-6">
      <div className="max-w-[720px] mx-auto pt-24 pb-24">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-fg">Plugins</h1>
          </div>
          <div className="relative shrink-0">
            <SearchGlyph className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none" />
            <input
              value={find}
              onChange={event => setFind(event.target.value)}
              placeholder="Search"
              aria-label="Search plugins"
              spellCheck={false}
              className="w-56 h-10 pl-10 pr-4 rounded-full bg-ink-800 text-sm text-fg placeholder:text-fg-muted outline-none transition-shadow duration-200 focus:shadow-[0_0_0_1px_rgb(255_255_255/0.12)] light:focus:shadow-[0_0_0_1px_rgb(0_0_0/0.14)]"
            />
          </div>
        </div>

        {installed.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold text-fg-muted mb-1.5">Installed</h2>
            <div className="space-y-0.5">
              {installed.map(one => (
                <PluginRow
                  key={one.id}
                  seed={one.name}
                  label={one.label}
                  blurb={one.blurb}
                  busy={connecting === pluginKey(one.name)}
                  trouble={trouble[pluginKey(one.name)]}
                  actionLabel={connected.has(pluginKey(one.name)) ? undefined : `Connect ${one.label}`}
                  onAdd={connected.has(pluginKey(one.name)) ? undefined : () => void connect(one)}
                  onOpen={connected.has(pluginKey(one.name)) ? () => runPluginAction(one) : undefined}
                  onRemove={() => remove(one)}
                />
              ))}
            </div>
          </section>
        )}

        {grouped.map(([group, rows]) =>
          rows.length === 0 ? null : (
            <section key={group} className="mt-10">
              <h2 className="text-sm font-semibold text-fg-muted mb-1.5">{group}</h2>
              <div className="space-y-0.5">
                {rows.map(one => (
                  <PluginRow
                    key={one.name}
                    seed={one.name}
                    label={one.label}
                    blurb={one.blurb}
                    busy={connecting === one.name}
                    trouble={trouble[one.name]}
                    onAdd={() => void connect(one)}
                  />
                ))}
              </div>
            </section>
          )
        )}

        <div className="mt-10">
          <AddPlugin />
        </div>
      </div>
    </div>
  )
}
