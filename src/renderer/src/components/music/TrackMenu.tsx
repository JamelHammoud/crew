import { useState } from 'react'
import { isMine, type MusicItem, type MusicPlaylist } from '../../../../shared/music'
import { ChevronLeftGlyph, MinusGlyph, MoreGlyph, PlusGlyph, TrashGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { useCrew } from '../../state/store'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'
import { quietRowButton } from './buttons'
import NewPlaylist from './NewPlaylist'

// Everything a row can do, in one menu at the end of it. A button per action
// grew the row every time the pointer landed on it and pushed the time along
// with it, and a menu opened from inside a row would hand its clicks back to the
// row underneath, which is why it stands beside the row rather than in it.
//
// The lists are a screen inside this menu rather than a menu hanging off it.
// One card is one thing to aim at, and it is asked for rather than opening
// itself under the pointer on the way past.
export default function TrackMenu({ item, within }: { item: MusicItem; within?: MusicPlaylist }) {
  const playlists = useMusic(s => s.playlists)
  const selfName = useCrew(s => s.selfName)
  const [open, setOpen] = useState(false)
  const [screen, setScreen] = useState<'main' | 'lists'>('main')
  const [naming, setNaming] = useState(false)
  // A list somebody else wrote is theirs to write in, so it is not offered here.
  const mine = playlists.filter(playlist => isMine(playlist, selfName))
  const inside = within && isMine(within, selfName) ? within : null

  const shut = () => {
    setOpen(false)
    setScreen('main')
  }

  const file = (playlistId: string, on: boolean) => {
    useMusic.getState().holdTrack(playlistId, item.id, on)
    shut()
  }

  return (
    <span className="relative shrink-0 flex">
      <Tooltip label="More" disabled={open}>
        <button
          onClick={() => {
            setScreen('main')
            setOpen(was => !was)
          }}
          aria-label={`More for ${item.name}`}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`${quietRowButton} ${open ? 'opacity-100 text-fg bg-fg/10' : ''}`}
        >
          <MoreGlyph className="w-4 h-4" />
        </button>
      </Tooltip>
      <Popover open={open} onClose={shut} className="min-w-56" maxHeight={320}>
        {screen === 'main' ? (
          <>
            <MenuItem icon={<PlusGlyph />} label="Add to playlist" into onClick={() => setScreen('lists')} />
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
                    shut()
                  }}
                />
              </>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setScreen('main')}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm font-medium text-fg/70 transition-colors hover:text-fg hover:bg-fg/5"
            >
              <ChevronLeftGlyph className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Add to playlist</span>
            </button>
            <MenuDivider />
            {mine.map(playlist => (
              <MenuItem
                key={playlist.id}
                label={playlist.name}
                checked={playlist.trackIds.includes(item.id)}
                onClick={() => file(playlist.id, !playlist.trackIds.includes(item.id))}
              />
            ))}
            <MenuItem
              icon={<PlusGlyph />}
              label="New playlist"
              onClick={() => {
                shut()
                setNaming(true)
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
