import { useState } from 'react'
import type { TicketQuestion } from '../../../../shared/tickets'
import { QuestionGlyph } from '../../icons'

// A question the agent raised and answered for itself. Answering is one press,
// answering late costs whatever was built on the assumption, and the count of
// files changed since is what says how much that is.
export default function QuestionCard({
  question,
  onAnswer
}: {
  question: TicketQuestion
  onAnswer: (answer: string) => void
}) {
  const [text, setText] = useState('')

  return (
    <div className="p-3 rounded-xl bg-ink-800">
      <div className="flex items-start gap-2.5">
        <QuestionGlyph className="w-4 h-4 mt-0.5 shrink-0 text-fg-secondary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg">{question.ask}</p>
          {question.assumed && <p className="mt-0.5 text-sm text-fg-muted">Working on {question.assumed}</p>}
          {question.since > 0 && (
            <p className="mt-0.5 text-xs text-fg-faint">
              {question.since === 1 ? '1 file changed since' : `${question.since} files changed since`}
            </p>
          )}
        </div>
      </div>
      {question.options.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {question.options.map(option => (
            <button
              key={option}
              onClick={() => onAnswer(option)}
              className="h-8 px-3.5 rounded-full bg-ink-700 text-sm font-medium text-fg-secondary transition-all duration-150 hover:bg-ink-600 hover:text-fg active:scale-95"
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <input
          value={text}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter' || !text.trim()) return
            onAnswer(text.trim())
            setText('')
          }}
          placeholder="Answer"
          className="mt-2.5 w-full h-9 px-3 rounded-full bg-ink-700 text-sm text-fg placeholder:text-fg-faint outline-none"
        />
      )}
    </div>
  )
}
