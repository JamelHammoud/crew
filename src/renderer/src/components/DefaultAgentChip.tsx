import { useDefaultAgent } from '../state/defaultAgent'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import ComposerChip from './ComposerChip'

// Who takes what you send, standing in the composer until it is taken off. It
// is the one chip that survives a send, since it is a standing choice rather
// than something about the message being written.
//
// The name is read off the crew's own list rather than out of what was written
// down, so a rename reads as the name they carry today. An id the crew has
// nothing for draws nothing rather than being forgotten: the agents arrive with
// the welcome, so a window still connecting has none of them yet and would take
// the choice off on the way in, and a crew that never had them is one to walk
// back out of with the choice still standing.
export default function DefaultAgentChip() {
  const aimed = useDefaultAgent(s => s.agentId)
  const agent = useCrew(s => s.agents.find(held => held.id === aimed))
  const aim = useDefaultAgent(s => s.aim)
  if (!agent) return null
  return (
    <ComposerChip
      mark={
        <AgentIcon
          seed={agent.id}
          size="xs"
          presence={agent.status === 'offline' ? 'offline' : 'online'}
        />
      }
      label={agent.label}
      removeLabel={`Stop sending to ${agent.label}`}
      onRemove={() => aim(place, null)}
    />
  )
}
