import { useState } from 'react'
import { isMine } from '../../../../shared/music'
import { PlusGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { useCrew } from '../../state/store'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'
import { rowActionQuiet } from './TrackRow'

// Filing a track under one of your own lists. A list somebody else wrote is
// theirs to write in, so it is not offered here.
export default function AddToPlaylist({ trackId, onNew }: { trackId: string; onNew: () => void }) {
  const playlists = useMusic(s => s.playlists)
  const selfName = useCrew(s => s.selfName)
  const [open, setOpen] = useState(false)
  const mine = playlists.filter(playlist => isMine(playlist, selfName))

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
      <Popover open={open} onClose={() => setOpen(false)} className="min-w-48" maxHeight={280}>
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
        <MenuItem
          icon={<PlusGlyph />}
          label="New playlist"
          onClick={() => {
            setOpen(false)
            onNew()
          }}
        />
      </Popover>
    </span>
  )
}
