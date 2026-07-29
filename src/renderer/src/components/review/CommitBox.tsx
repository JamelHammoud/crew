import type { KeyboardEvent } from 'react'
import Spinner from '../Spinner'
import { useAutoResize } from '../useAutoResize'

export default function CommitBox({
  message,
  onMessage,
  staged,
  busy,
  onCommit
}: {
  message: string
  onMessage: (text: string) => void
  staged: number
  busy: boolean
  onCommit: () => void
}) {
  const ref = useAutoResize(message, 140)
  const ready = staged > 0 && message.trim().length > 0 && !busy

  const keys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    if (ready) onCommit()
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        rows={1}
        value={message}
        onChange={event => onMessage(event.target.value)}
        onKeyDown={keys}
        placeholder="What changed"
        className={`w-full resize-none rounded-card border border-ink-700 bg-ink-800 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-faint focus:border-fg/20 focus:outline-none ${
          message ? 'select-text' : ''
        }`}
      />
      <button
        onClick={onCommit}
        disabled={!ready}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-full bg-fg text-sm font-medium text-ink-900 transition-all hover:bg-fg/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35"
      >
        {busy && <Spinner size={13} />}
        {staged > 0 ? `Commit ${staged} ${staged === 1 ? 'file' : 'files'}` : 'Commit'}
      </button>
    </div>
  )
}
