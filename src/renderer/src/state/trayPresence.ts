import { attachmentFileUrl } from '../../../shared/attachments'
import { presentNow, type Present } from '../../../shared/presence'
import { useCrew } from './store'

const same = (a: Present[], b: Present[]): boolean =>
  a.length === b.length &&
  a.every(
    (one, index) =>
      one.id === b[index].id &&
      one.name === b[index].name &&
      one.threads === b[index].threads &&
      one.photo === b[index].photo
  )

export function presenceNow(state: ReturnType<typeof useCrew.getState>): Present[] {
  return presentNow(state.members, state.agents, state.selfId, state.activePrompts, agent =>
    agent.avatar && state.httpBase ? attachmentFileUrl(state.httpBase, agent.avatar) : undefined
  )
}

// The menu bar has no session of its own, so the window hands it what it sees,
// and only when it changes: the store moves on every keystroke.
export function publishPresence(): () => void {
  let last: Present[] | null = null
  const send = (): void => {
    const here = presenceNow(useCrew.getState())
    if (last && same(last, here)) return
    last = here
    window.crew?.publishPresence?.(here)
  }
  send()
  return useCrew.subscribe(send)
}
