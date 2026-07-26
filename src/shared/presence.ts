import type { PooledAgent } from './llm'
import type { MemberInfo } from './protocol'

export interface Present {
  id: string
  name: string
  agent: boolean
  threads: number
  photo?: string
}

export interface PresenceSnapshot {
  here: Present[]
  sharing: boolean
  known: boolean
  waiting: number
}

export const emptyPresence = (): PresenceSnapshot => ({
  here: [],
  sharing: false,
  known: false,
  waiting: 0
})

export function presentNow(
  members: MemberInfo[],
  agents: PooledAgent[],
  selfId: string,
  activePrompts: Record<string, string[]> = {},
  photoOf: (agent: PooledAgent) => string | undefined = () => undefined
): Present[] {
  const threadsOf = (agent: PooledAgent): number => (activePrompts[agent.id] ?? []).length
  return [
    ...members
      .filter(member => member.connected && member.id !== selfId)
      .map(member => ({ id: member.id, name: member.name, agent: false, threads: 0 })),
    ...agents
      .filter(agent => threadsOf(agent) > 0 || agent.status === 'busy')
      .map(agent => ({
        id: agent.id,
        name: agent.label,
        agent: true,
        threads: threadsOf(agent),
        photo: photoOf(agent)
      }))
  ]
}
