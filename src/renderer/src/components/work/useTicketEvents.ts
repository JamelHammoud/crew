import { useMemo } from 'react'
import type { TicketEvent } from '../../../../shared/tickets'
import { useCrew } from '../../state/store'

// What the agent said about its own work, on this thread alone. A board is
// written down as what happened rather than held anywhere as a board, so this
// is the whole of what the panel reads.
export function useTicketEvents(threadId: string): TicketEvent[] {
  const tickets = useCrew(s => s.tickets)
  return useMemo(() => tickets.filter(event => event.threadId === threadId), [tickets, threadId])
}
