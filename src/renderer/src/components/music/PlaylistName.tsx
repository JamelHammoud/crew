import { useEffect, useRef, useState } from 'react'
import { PLAYLIST_NAME_LIMIT } from '../../../../shared/music'
import Modal from '../Modal'
import Spinner from '../Spinner'

// One card that asks one thing: what the list is called. Naming a new one and
// renaming an old one are the same question, so they are the same card.
export default function PlaylistName({
  open,
  title,
  action,
  name: given = '',
  onClose,
  onSubmit
}: {
  open: boolean
  title: string
  action: string
  name?: string
  onClose: () => void
  onSubmit: (name: string) => boolean | Promise<boolean>
}) {
  const [name, setName] = useState(given)
  const [busy, setBusy] = useState(false)
  const [trouble, setTrouble] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const asked = name.trim()

  useEffect(() => {
    if (!open) return
    setName(given)
    setTrouble(false)
    setBusy(false)
    // Opened on a name that is already there, all of it is selected, so typing
    // replaces it and the caret is still at the end for anyone who would rather
    // edit what is written.
    const box = field.current
    if (!box) return
    box.focus()
    box.select()
  }, [open, given])

  const send = async () => {
    if (!asked || busy) return
    setBusy(true)
    setTrouble(false)
    const done = await onSubmit(asked)
    setBusy(false)
    if (done) onClose()
    else setTrouble(true)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={() => void send()}
            disabled={!asked || busy}
            className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-2 transition-all duration-150 hover:scale-[1.03] active:scale-95 disabled:bg-fg/10 disabled:text-fg/45 disabled:scale-100"
          >
            {busy && <Spinner size={14} />}
            {action}
          </button>
        </div>
      }
    >
      <input
        ref={field}
        autoFocus
        value={name}
        disabled={busy}
        maxLength={PLAYLIST_NAME_LIMIT}
        placeholder="Name"
        aria-label="Playlist name"
        spellCheck={false}
        onChange={event => setName(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') void send()
        }}
        className="mt-4 w-full h-11 px-3.5 rounded-xl bg-fg/[0.07] text-sm text-fg placeholder:text-fg/35 outline-none border-none transition-colors focus:bg-fg/[0.11]"
      />
      {trouble && <p className="mt-3 text-sm text-danger">That did not go through. Try again.</p>}
    </Modal>
  )
}
