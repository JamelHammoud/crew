import type { KeyboardEvent } from 'react'
import Modal from '../Modal'
import Spinner from '../Spinner'
import { useAutoResize } from '../useAutoResize'

export default function CommitDialog({
  open,
  staged,
  message,
  busy,
  onMessage,
  onClose,
  onCommit
}: {
  open: boolean
  staged: number
  message: string
  busy: boolean
  onMessage: (text: string) => void
  onClose: () => void
  onCommit: () => void
}) {
  const ref = useAutoResize(message, 200)
  const ready = message.trim().length > 0 && !busy

  // The card is opened to write in, so the caret is already in the one field on
  // it rather than a press away.
  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open, ref])

  const keys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    if (ready) onCommit()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Commit ${staged} ${staged === 1 ? 'file' : 'files'}`}
    >
      <textarea
        ref={ref}
        rows={2}
        value={message}
        onChange={event => onMessage(event.target.value)}
        onKeyDown={keys}
        placeholder="What changed"
        className="mt-4 w-full resize-none rounded-card border border-fg/10 bg-fg/[0.04] px-3.5 py-2.5 text-sm text-fg placeholder:text-fg/30 focus:border-fg/25 focus:outline-none"
      />
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="h-10 rounded-full px-4 text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
        >
          Cancel
        </button>
        <button
          onClick={onCommit}
          disabled={!ready}
          className="flex h-10 items-center gap-2 rounded-full bg-fg px-5 text-sm font-semibold text-ink-900 transition-all duration-150 hover:scale-[1.03] active:scale-95 disabled:scale-100 disabled:bg-fg/10 disabled:text-fg/45"
        >
          {busy && <Spinner size={14} />}
          Commit
        </button>
      </div>
    </Modal>
  )
}
