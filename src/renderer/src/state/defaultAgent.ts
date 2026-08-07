import { create } from 'zustand'

// Who takes what you send in the chat when the words name nobody. It is yours
// rather than the crew's, the way the volume is: it sits on this machine and
// nothing about it is ever sent, so two people in one crew each aim their own
// composer.
//
// It is kept per place, because an agent id belongs to the crew it was made in
// and a window walks between crews without ever unmounting: one record for the
// window would aim the chat at an agent the project it landed in never had.
//
// It is kept on this machine and it has to be. Held in the window alone, every
// reload takes it off, and a renderer reloads whenever the project is edited
// under it, which is most of an afternoon with an agent working.

const KEY = 'crew.default-agent'
// Places this is remembered for. The oldest goes first, so a machine that has
// opened projects for months is not carrying an agent from every one of them.
const PLACE_LIMIT = 20

type Aimed = Record<string, string>

function aimedOf(raw: unknown): Aimed {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const held: Aimed = {}
  for (const [place, agentId] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof agentId === 'string' && agentId) held[place] = agentId
  }
  return held
}

function load(): Aimed {
  try {
    return aimedOf(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null'))
  } catch {
    return {}
  }
}

function save(aimed: Aimed): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(aimed))
  } catch {
    // A window with no storage keeps it for as long as it is open, which is
    // still better than losing it while it is.
  }
}

// Whatever was chosen last goes to the end, so the oldest place is the first to
// go rather than whichever happened to be opened first.
const trim = (aimed: Aimed): Aimed => {
  const places = Object.keys(aimed)
  if (places.length <= PLACE_LIMIT) return aimed
  const next = { ...aimed }
  for (const old of places.slice(0, places.length - PLACE_LIMIT)) delete next[old]
  return next
}

type DefaultAgents = {
  aimed: Aimed
  aim(place: string, agentId: string | null): void
}

export const useDefaultAgents = create<DefaultAgents>(set => ({
  aimed: load(),
  aim: (place, agentId) =>
    set(state => {
      if (!place) return state
      const { [place]: gone, ...rest } = state.aimed
      void gone
      const aimed = agentId ? trim({ ...rest, [place]: agentId }) : rest
      save(aimed)
      return { aimed }
    })
}))

export const aimedAt = (aimed: Aimed, place: string): string | null => aimed[place] ?? null
