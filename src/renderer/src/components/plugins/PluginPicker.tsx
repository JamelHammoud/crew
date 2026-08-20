import { resolvePlugins } from '../../../../shared/plugins'
import { CheckGlyph } from '../../icons'
import { useMessagePlugin } from '../../state/messagePlugin'
import { useCrew } from '../../state/store'
import PluginMark from './PluginMark'

// What the crew has plugged in, as a screen inside the plus rather than a menu
// hanging off it, the way the agents and the GIFs already stand there. Picking
// one puts it on the message being written, and picking the one that is already
// on it takes it off, so the row is the way in and the way out both.
export default function PluginPicker({ where, onPick }: { where: string; onPick: () => void }) {
  const plugins = useCrew(s => s.plugins)
  const picked = useMessagePlugin(s => s.picked[where])
  const pick = useMessagePlugin(s => s.pick)
  const held = resolvePlugins(plugins)

  return (
    <div className="p-1.5 w-64 max-h-[352px] overflow-y-auto overscroll-contain no-scrollbar">
      {held.map(plugin => (
        <button
          key={plugin.id}
          onClick={() => {
            pick(where, picked === plugin.name ? null : plugin.name)
            onPick()
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left whitespace-nowrap transition-colors text-fg/70 hover:text-fg hover:bg-fg/5"
        >
          <PluginMark seed={plugin.name} box={20} />
          <span className="flex-1 truncate">{plugin.label}</span>
          {picked === plugin.name && <CheckGlyph className="w-4 h-4 shrink-0 text-fg" />}
        </button>
      ))}
    </div>
  )
}
