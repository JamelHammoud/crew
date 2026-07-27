import { useEffect, useRef, useState } from 'react'
import { PLAYLIST_NAME_LIMIT } from '../../../../shared/music'
import { useMusic } from '../../state/music'
import Modal from '../Modal'
import Spinner from '../Spinner'

// Making a list is one card that asks one thing. It is named, it is written
// down, and whoever asked is handed it the moment it lands, so the panel can
// open on it and a track can be filed into it in the same breath. Nothing is
// made by wandering off and nothing typed is lost by it either.
export default function NewPlaylist({
  open,
  onClose,
  onMade
}: {
  open: boolean
  onClose: () => void
  onMade: (playlistId: string) => void
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [trouble, setTrouble] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const asked = name.trim()

  useEffect(() => {
    if (!open) return
    setName('')
    setTrouble(false)
    field.current?.focus()
  }, [open])

  const make = async () => {
    if (!asked || busy) return
    setBusy(true)
    setTrouble(false)
    const playlistId = await useMusic.getState().makePlaylist(asked)
    setBusy(false)
    if (!playlistId) {
      setTrouble(true)
      return
    }
    onClose()
    onMade(playlistId)
  }

  return (
    <Modal open={open} onClose={onClose} title="New playlist">
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
          if (event.key === 'Enter') void make()
        }}
        className="mt-4 w-full h-11 px-4 rounded-full bg-fg/10 text-sm text-fg placeholder:text-fg/40 outline-none transition-colors focus:bg-fg/[0.14]"
      />
      {trouble && <p className="mt-3 text-sm text-danger">That did not go through. Try again.</p>}
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
        >
          Cancel
        </button>
        <button
          onClick={() => void make()}
          disabled={!asked || busy}
          className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold flex items-center gap-2 transition-all duration-150 hover:scale-[1.03] active:scale-95 disabled:bg-fg/10 disabled:text-fg/45 disabled:scale-100"
        >
          {busy && <Spinner size={14} />}
          Create
        </button>
      </div>
    </Modal>
  )
}
