import { useState } from 'react'
import type { Ticket } from '../../../../shared/tickets'
import { ChevronDownGlyph } from '../../icons'
import { useBrowser } from '../../state/browser'

// One piece of work. What it is, what was decided inside it, and what it
// touched. A ticket waiting to be looked at carries the two ways out of that:
// say it is fine, or say what is wrong, which goes back to the agent as a steer.
export default function TicketRow({
  ticket,
  onSay,
  onCleared
}: {
  ticket: Ticket
  onSay: (text: string) => void
  onCleared: () => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const reviewing = ticket.column === 'review'
  const inside = ticket.decisions.length + ticket.files.length > 0

  return (
    <div className={`rounded-xl ${reviewing ? 'bg-ink-800' : 'bg-ink-800/60'}`}>
      <button
        onClick={() => inside && setOpen(o => !o)}
        disabled={!inside}
        className="w-full px-3 py-2.5 flex items-start gap-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className={`block text-sm ${ticket.column === 'done' ? 'text-fg-muted' : 'text-fg'}`}>
            {ticket.title}
          </span>
          {ticket.review && <span className="mt-0.5 block text-sm text-fg-secondary">{ticket.review}</span>}
          {inside && (
            <span className="mt-0.5 block text-xs text-fg-faint">
              {[
                ticket.decisions.length === 1 ? '1 decision' : ticket.decisions.length > 1 ? `${ticket.decisions.length} decisions` : '',
                ticket.files.length === 1 ? '1 file' : ticket.files.length > 1 ? `${ticket.files.length} files` : ''
              ]
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
        </span>
        {inside && (
          <ChevronDownGlyph
            className={`w-4 h-4 mt-0.5 shrink-0 text-fg-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {open && (
        <div className="px-3 pb-2.5 space-y-1">
          {ticket.decisions.map((decision, index) => (
            <p key={index} className="text-sm text-fg-secondary select-text">
              {decision}
            </p>
          ))}
          {ticket.files.map(path => (
            <button
              key={path}
              onClick={() => useBrowser.getState().openFile(path)}
              className="block max-w-full truncate text-left text-xs text-fg-muted transition-colors hover:text-fg"
            >
              {path}
            </button>
          ))}
        </div>
      )}
      {reviewing && (
        <div className="px-3 pb-3 flex items-center gap-1.5">
          <input
            value={text}
            onChange={event => setText(event.target.value)}
            onKeyDown={event => {
              if (event.key !== 'Enter' || !text.trim()) return
              onSay(text.trim())
              setText('')
            }}
            placeholder="Send it back"
            className="flex-1 min-w-0 h-9 px-3 rounded-full bg-ink-700 text-sm text-fg placeholder:text-fg-faint outline-none"
          />
          <button
            onClick={onCleared}
            className="h-9 px-3.5 shrink-0 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-all duration-150 hover:bg-fg/90 active:scale-95"
          >
            Looks good
          </button>
        </div>
      )}
    </div>
  )
}
