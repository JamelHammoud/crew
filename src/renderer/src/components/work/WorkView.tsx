import { useMemo, useRef } from 'react'
import { boardOf, TICKET_COLUMNS, type TicketColumn } from '../../../../shared/tickets'
import { BoardGlyph } from '../../icons'
import { useBoard } from '../../state/board'
import { useCrew } from '../../state/store'
import ScrollFade from '../ScrollFade'
import useScrollEdges from '../useScrollEdges'
import { useThreadSteps } from '../useThreadSteps'
import QuestionCard from './QuestionCard'
import TicketRow from './TicketRow'

// The columns run in the order they want you rather than in the order work
// travels through them. A review is somebody being waited on, what is being
// worked on now is next, and what is finished is last.
const ORDER: TicketColumn[] = ['review', 'doing', 'todo', 'done']

const labelOf = (column: TicketColumn): string =>
  TICKET_COLUMNS.find(one => one.key === column)?.label ?? column

export default function WorkView({ threadId }: { threadId: string }) {
  const steps = useThreadSteps(threadId)
  const sendChat = useCrew(s => s.sendChat)
  const answered = useBoard(s => s.answered[threadId])
  const reviewed = useBoard(s => s.reviewed[threadId])
  const scrollRef = useRef<HTMLDivElement>(null)
  const { edges } = useScrollEdges(scrollRef)
  const board = useMemo(() => boardOf(steps, { answered, reviewed }), [steps, answered, reviewed])
  const empty = board.tickets.length === 0 && board.questions.length === 0

  return (
    <div className="absolute inset-0 flex flex-col bg-ink-900">
      <div className="relative flex-1 min-h-0 min-w-0">
        <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden px-4 py-4 space-y-5">
          {empty && (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <BoardGlyph className="w-8 h-8 text-fg-faint" />
              <p className="text-sm text-fg-muted">Nothing on the board yet</p>
            </div>
          )}
          {board.questions.length > 0 && (
            <section className="space-y-1.5">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                {board.questions.length === 1 ? 'Question' : 'Questions'}
              </h2>
              {board.questions.map(question => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  onAnswer={answer => {
                    sendChat(`${question.ask}\n${answer}`, threadId)
                    useBoard.getState().answer(threadId, question.id)
                  }}
                />
              ))}
            </section>
          )}
          {ORDER.map(column => {
            const tickets = board.tickets.filter(ticket => ticket.column === column)
            if (tickets.length === 0) return null
            return (
              <section key={column} className="space-y-1.5">
                <h2 className="px-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {labelOf(column)}
                  <span className="text-fg-faint">{tickets.length}</span>
                </h2>
                {tickets.map(ticket => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    onSay={text => sendChat(`${ticket.title}\n${text}`, threadId)}
                    onCleared={() => useBoard.getState().reviewedIt(threadId, ticket.id)}
                  />
                ))}
              </section>
            )
          })}
        </div>
        <ScrollFade edges={edges} />
      </div>
    </div>
  )
}
