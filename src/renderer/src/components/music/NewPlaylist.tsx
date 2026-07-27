import { useState } from 'react'
import { PLAYLIST_NAME_LIMIT } from '../../../../shared/music'
import { CloseGlyph, PlusGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import Spinner from '../Spinner'
import Tooltip from '../Tooltip'
import { roundButton, solidButton } from './buttons'

// Making a list, all the way through: it is named, it is written down, and it
// opens on the list itself, so there is somewhere to be once it exists. Nothing
// is made by wandering off, and nothing typed is lost by it either.
export default function NewPlaylist({ onMade }: { onMade: (playlistId: string) => void }) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const asked = name.trim()

  const stop = () => {
    setName('')
    setNaming(false)
  }

  const make = async () => {
    if (!asked || busy) return
    setBusy(true)
    const playlistId = await useMusic.getState().makePlaylist(asked)
    setBusy(false)
    stop()
    if (playlistId) onMade(playlistId)
  }

  return (
    <li className="h-14 px-2 rounded-2xl flex items-center gap-2">
      <span className="w-10 h-10 mr-1 shrink-0 rounded-[10px] border border-dashed border-fg/15 flex items-center justify-center text-fg-faint">
        {busy ? <Spinner size={16} /> : <PlusGlyph className="w-4 h-4" />}
      </span>
      {naming ? (
        <>
          <input
            autoFocus
            value={name}
            disabled={busy}
            maxLength={PLAYLIST_NAME_LIMIT}
            placeholder="Name it"
            aria-label="Name the playlist"
            spellCheck={false}
            onChange={event => setName(event.target.value)}
            onBlur={() => {
              if (!asked) stop()
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') void make()
              if (event.key === 'Escape') stop()
            }}
            className="flex-1 min-w-0 h-9 px-3.5 rounded-full bg-fg/[0.06] text-sm text-fg placeholder:text-fg-faint outline-none transition-colors focus:bg-fg/[0.08]"
          />
          <button
            onClick={() => void make()}
            disabled={!asked || busy}
            className={`${solidButton} h-9 px-3.5 text-xs font-semibold disabled:opacity-30`}
          >
            Create
          </button>
          <Tooltip label="Cancel">
            <button onClick={stop} aria-label="Cancel" className={`${roundButton} w-7 h-7`}>
              <CloseGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        </>
      ) : (
        <button onClick={() => setNaming(true)} className="flex-1 min-w-0 h-full text-left text-sm text-fg-secondary">
          New playlist
        </button>
      )}
    </li>
  )
}
