import { useMemo } from 'react'
import { isTicketEvent, type TicketEvent } from '../../../../shared/tickets'
import { useCrew } from '../../state/store'

// What the agent said about its own work, on this thread alone. It is read off
// the session's events the way the steps are, because a board is written down
// as what happened rather than held anywhere as a board.
export function useTicketEvents(threadId: string): TicketEvent[] {
  const events = useCrew(s => s.events)
  return useMemo(
    () =>
      events.filter(
        (event): event is TicketEvent => isTicketEvent(event.kind) && (event as TicketEvent).threadId === threadId
      ),
    [events, threadId]
  )
}
