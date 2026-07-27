import { useState } from 'react'
import { isMine, type MusicItem, type MusicPlaylist } from '../../../../shared/music'
import { MinusGlyph, MoreGlyph, PlusGlyph, TrashGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { useCrew } from '../../state/store'
import { MenuDivider, MenuItem, Popover, SubMenu } from '../Popover'
import Tooltip from '../Tooltip'
import { quietRowButton } from './buttons'
import NewPlaylist from './NewPlaylist'

// Everything a row can do, in one menu at the end of it. A button per action
// grew the row every time the pointer landed on it and pushed the time along
// with it, and a menu opened from inside a row would hand its clicks back to the
// row underneath, which is why it stands beside the row rather than in it.
export default function TrackMenu({ item, within }: { item: MusicItem; within?: MusicPlaylist }) {
  const playlists = useMusic(s => s.playlists)
  const selfName = useCrew(s => s.selfName)
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  // A list somebody else wrote is theirs to write in, so it is not offered here.
  const mine = playlists.filter(playlist => isMine(playlist, selfName))
  const inside = within && isMine(within, selfName) ? within : null

  const file = (playlistId: string, on: boolean) => {
    useMusic.getState().holdTrack(playlistId, item.id, on)
    setOpen(false)
  }

  return (
    <span className="relative shrink-0 flex">
      <Tooltip label="More" disabled={open}>
        <button
          onClick={() => setOpen(was => !was)}
          aria-label={`More for ${item.name}`}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`${quietRowButton} ${open ? 'opacity-100 text-fg bg-fg/10' : ''}`}
        >
          <MoreGlyph className="w-4 h-4" />
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} className="min-w-52" maxHeight={320}>
        <SubMenu icon={<PlusGlyph />} label="Add to playlist" maxHeight={280}>
          {mine.map(playlist => (
            <MenuItem
              key={playlist.id}
              label={playlist.name}
              checked={playlist.trackIds.includes(item.id)}
              onClick={() => file(playlist.id, !playlist.trackIds.includes(item.id))}
            />
          ))}
          {mine.length > 0 && <MenuDivider />}
          <MenuItem
            icon={<PlusGlyph />}
            label="New playlist"
            onClick={() => {
              setOpen(false)
              setNaming(true)
            }}
          />
        </SubMenu>
        {inside && (
          <MenuItem
            icon={<MinusGlyph />}
            label="Remove from this playlist"
            onClick={() => file(inside.id, false)}
          />
        )}
        {item.file && (
          <>
            <MenuDivider />
            <MenuItem
              icon={<TrashGlyph />}
              danger
              label="Delete track"
              onClick={() => {
                useMusic.getState().remove(item.id)
                setOpen(false)
              }}
            />
          </>
        )}
      </Popover>
      <NewPlaylist
        open={naming}
        onClose={() => setNaming(false)}
        onMade={playlistId => useMusic.getState().holdTrack(playlistId, item.id, true)}
      />
    </span>
  )
}
