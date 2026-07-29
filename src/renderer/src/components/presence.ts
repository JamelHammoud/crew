import { useCrew } from '../state/store'

export type Presence = 'online' | 'offline' | undefined

// Where you stand in this crew, in one place, so the menu and the settings can
// never say two different things about it.
export function useStanding(): string {
  return useCrew(s =>
    s.connection === 'reconnecting'
      ? 'Reconnecting'
      : s.connection === 'connecting'
        ? 'Connecting'
        : !s.hosting
          ? 'Joined'
          : s.shared
            ? 'Hosting'
            : 'On this machine'
  )
}

export function usePresence(name: string, id?: string): Presence {
  return useCrew(s => {
    const member = s.members.find(m => (id ? m.id === id : m.name === name))
    if (member) return member.connected ? 'online' : 'offline'
    const agent = s.agents.find(a => (id ? a.id === id : a.label === name))
    if (agent) return agent.status === 'offline' ? 'offline' : 'online'
    return undefined
  })
}
