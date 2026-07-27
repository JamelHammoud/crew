import { useState } from 'react'
import { isMine, PLAYLIST_NAME_LIMIT } from '../../../../shared/music'
import { PlusGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { useCrew } from '../../state/store'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Spinner from '../Spinner'
import Tooltip from '../Tooltip'
import { rowActionQuiet } from './TrackRow'

// Filing a track under one of your own lists. A list somebody else wrote is
// theirs to write in, so it is not offered here. A new one is named here too,
// with the track already in it, rather than leaving the track behind and taking
// you off to another tab to write the list you were about to fill.
export default function AddToPlaylist({ trackId }: { trackId: string }) {
  const playlists = useMusic(s => s.playlists)
  const selfName = useCrew(s => s.selfName)
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const mine = playlists.filter(playlist => isMine(playlist, selfName))
  const asked = name.trim()

  const shut = () => {
    setName('')
    setNaming(false)
    setOpen(false)
  }

  const make = async () => {
    if (!asked || busy) return
    setBusy(true)
    const playlistId = await useMusic.getState().makePlaylist(asked)
    setBusy(false)
    if (playlistId) useMusic.getState().holdTrack(playlistId, trackId, true)
    shut()
  }

  return (
    <span className="relative shrink-0 flex">
      <Tooltip label="Add to a playlist" disabled={open}>
        <button
          onClick={() => setOpen(was => !was)}
          aria-label="Add to a playlist"
          aria-expanded={open}
          aria-haspopup="menu"
          className={`${rowActionQuiet} ${open ? 'opacity-100 text-fg bg-fg/10' : ''}`}
        >
          <PlusGlyph className="w-4 h-4" />
        </button>
      </Tooltip>
      <Popover open={open} onClose={shut} className="min-w-48" maxHeight={280}>
        {mine.map(playlist => (
          <MenuItem
            key={playlist.id}
            label={playlist.name}
            checked={playlist.trackIds.includes(trackId)}
            onClick={() => {
              useMusic.getState().holdTrack(playlist.id, trackId, !playlist.trackIds.includes(trackId))
              setOpen(false)
            }}
          />
        ))}
        {mine.length > 0 && <MenuDivider />}
        {naming ? (
          <div className="px-1.5 py-1 flex items-center gap-2">
            <input
              autoFocus
              value={name}
              disabled={busy}
              maxLength={PLAYLIST_NAME_LIMIT}
              placeholder="Name it"
              aria-label="Name the playlist"
              spellCheck={false}
              onChange={event => setName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') void make()
              }}
              className="w-40 h-8 px-3 rounded-full bg-fg/10 text-sm text-fg placeholder:text-fg/40 outline-none"
            />
            <button
              onClick={() => void make()}
              disabled={!asked || busy}
              aria-label="Create the playlist"
              className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-fg text-ink-900 transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:opacity-30"
            >
              {busy ? <Spinner size={14} /> : <PlusGlyph className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <MenuItem icon={<PlusGlyph />} label="New playlist" onClick={() => setNaming(true)} />
        )}
      </Popover>
    </span>
  )
}
