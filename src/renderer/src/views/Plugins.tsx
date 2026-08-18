import { useMemo, useState } from 'react'
import { PLUGIN_GROUPS, PLUGIN_OFFERS, pluginKey, resolvePlugins, type PluginOffer } from '../../../shared/plugins'
import AddPlugin from '../components/plugins/AddPlugin'
import PluginRow from '../components/plugins/PluginRow'
import { SearchGlyph } from '../icons'
import { useCrew } from '../state/store'
import { runPluginAction } from '../state/pluginState'

const matches = (find: string, ...words: string[]): boolean =>
  !find || words.some(word => word.toLowerCase().includes(find.toLowerCase().trim()))

export default function Plugins() {
  const plugins = useCrew(s => s.plugins)
  const addPlugin = useCrew(s => s.addPlugin)
  const removePlugin = useCrew(s => s.removePlugin)
  const [find, setFind] = useState('')

  const held = useMemo(() => new Set(plugins.map(one => pluginKey(one.name))), [plugins])
  const installed = resolvePlugins(plugins).filter(one => matches(find, one.label, one.blurb, one.name))
  const offers = PLUGIN_OFFERS.filter(one => !held.has(one.name) && matches(find, one.label, one.blurb, one.name))
  const grouped: Array<[string, PluginOffer[]]> = PLUGIN_GROUPS.map(group => [
    group,
    offers.filter(one => one.group === group)
  ])

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
                  onOpen={() => runPluginAction(one)}
                  onRemove={() => removePlugin(one.id)}
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
                    onAdd={() => addPlugin(one)}
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
