import { useCrew } from '../state/store'

export type Presence = 'online' | 'offline' | undefined

export function usePresence(name: string): Presence {
  return useCrew(s => {
    const member = s.members.find(m => m.name === name)
    if (member) return member.connected ? 'online' : 'offline'
    const agent = s.agents.find(a => a.label === name)
    if (agent) return agent.status === 'offline' ? 'offline' : 'online'
    return undefined
  })
}
