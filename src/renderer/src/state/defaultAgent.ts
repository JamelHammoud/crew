import { create } from 'zustand'

// The default agent: who takes what you send in the chat when the words name
// nobody. It is yours rather than the crew's, the way the volume is: it sits on
// this machine and nothing about it is ever sent, so two people in one crew each
// aim their own composer.
//
// It is one standing choice rather than one per project. An agent is the
// machine's own, kept in that machine's agents.json and pooled into whichever
// crew it is joined to, so an id names the same agent wherever it turns up and
// there is nothing about a project for it to belong to. Keyed by the place it
// also went off on its own: a crew joined over a link is keyed by that link, and
// the port in one moves whenever the host reopens, so the choice quietly came
// off a project that was never left.
//
// It is kept on this machine and it has to be. Held in the window alone, every
// reload takes it off, and a renderer reloads whenever the project is edited
// under it, which is most of an afternoon with an agent working.

const KEY = 'crew.default-agent'

// The value written down was a record of one agent per place. Read as anything
// but the id it is now, it is nobody, so a machine that had one picked before
// this comes up with an empty composer rather than aimed at a place.
function load(): string | null {
  try {
    const held: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null')
    return typeof held === 'string' && held ? held : null
  } catch {
    return null
  }
}

function save(agentId: string | null): void {
  try {
    if (agentId) globalThis.localStorage?.setItem(KEY, JSON.stringify(agentId))
    else globalThis.localStorage?.removeItem(KEY)
  } catch {
    // A window with no storage keeps it for as long as it is open, which is
    // still better than losing it while it is.
  }
}

type DefaultAgent = {
  agentId: string | null
  aim(agentId: string | null): void
}

export const useDefaultAgent = create<DefaultAgent>(set => ({
  agentId: load(),
  aim: agentId => {
    save(agentId)
    return set({ agentId })
  }
}))
