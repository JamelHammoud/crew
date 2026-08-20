import { create } from 'zustand'

// The plugin somebody put on the message they are writing, held by the composer
// it was picked in. It is about that one message rather than a standing choice,
// so it goes with the send and is never written down: a composer that has been
// emptied has nothing to carry.
type MessagePluginState = {
  picked: Record<string, string>
  pick(where: string, name: string | null): void
  taken(where: string): void
}

export const useMessagePlugin = create<MessagePluginState>((set, get) => ({
  picked: {},
  pick: (where, name) =>
    set(state => {
      const picked = { ...state.picked }
      if (name) picked[where] = name
      else delete picked[where]
      return { picked }
    }),
  taken: where => get().pick(where, null)
}))

export const messagePluginIn = (where: string): string | undefined => useMessagePlugin.getState().picked[where]
