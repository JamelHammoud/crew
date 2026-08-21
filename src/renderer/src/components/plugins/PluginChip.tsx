import { useEffect } from 'react'
import { resolvePlugin } from '../../../../shared/plugins'
import { useMessagePlugin } from '../../state/messagePlugin'
import { locallyConnected, usePluginConnections } from '../../state/pluginConnections'
import { useCrew } from '../../state/store'
import ComposerChip from '../ComposerChip'
import PluginMark from './PluginMark'

// The plugin on the message being written. The name is read off the crew's own
// list rather than out of what was picked, so one taken out of the crew while
// somebody was writing draws nothing rather than standing there naming itself.
export default function PluginChip({ where }: { where: string }) {
  const picked = useMessagePlugin(s => s.picked[where])
  const pick = useMessagePlugin(s => s.pick)
  const plugin = useCrew(s => s.plugins.find(held => held.name === picked))
  const connectionIds = usePluginConnections(s => s.ids)
  const connected = Boolean(plugin && locallyConnected(plugin, connectionIds))
  useEffect(() => {
    if (picked && !connected) pick(where, null)
  }, [connected, pick, picked, where])
  if (!plugin || !connected) return null
  const resolved = resolvePlugin(plugin)
  return (
    <ComposerChip
      mark={<PluginMark seed={resolved.name} box={20} />}
      label={resolved.label}
      removeLabel={`Remove ${resolved.label}`}
      onRemove={() => pick(where, null)}
    />
  )
}
