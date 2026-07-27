import { useMemo, useRef, useState } from 'react'
import { findMusic, musicItems, type MusicItem } from '../../../../shared/music'
import { PlusGlyph, TrashGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import Spinner from '../Spinner'
import Tooltip from '../Tooltip'
import AddToPlaylist from './AddToPlaylist'
import TrackRow, { rowActionQuiet } from './TrackRow'

// Everything the crew can play: the app's own tunes and whatever anyone has put
// on the shelf. Putting something on from here plays the shelf through rather
// than any one list.
export default function Songs({ query }: { query: string }) {
  const room = useMusic(s => s.room)
  const uploads = useMusic(s => s.uploads)
  const adding = useMusic(s => s.adding)
  const [addTrouble, setAddTrouble] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const items = useMemo(() => findMusic(musicItems(uploads), query), [uploads, query])

  const put = (one: MusicItem) => {
    if (one.id === room.trackId) useMusic.getState().toggle()
    else useMusic.getState().put(one.id)
  }

  const take = async (file: File | undefined) => {
    if (!file) return
    setAddTrouble(await useMusic.getState().add(file))
  }

  return (
    <ul className="p-2">
      {items.map(one => (
        <TrackRow
          key={one.id}
          item={one}
          on={one.id === room.trackId}
          playing={room.playing}
          onPlay={() => put(one)}
          actions={
            <>
              <AddToPlaylist trackId={one.id} />
              {one.file && (
                <Tooltip label="Remove">
                  <button
                    onClick={() => useMusic.getState().remove(one.id)}
                    aria-label={`Remove ${one.name}`}
                    className={rowActionQuiet}
                  >
                    <TrashGlyph className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
            </>
          }
        />
      ))}

      {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-muted">No tracks found</li>}

      {!query.trim() && (
        <li>
          <button
            onClick={() => picker.current?.click()}
            disabled={adding}
            className="w-full h-14 px-2 rounded-2xl flex items-center gap-3 text-left transition-colors duration-150 hover:bg-fg/[0.04] disabled:opacity-50"
          >
            <span className="w-10 h-10 shrink-0 rounded-[10px] border border-dashed border-fg/15 flex items-center justify-center text-fg-faint">
              {adding ? <Spinner size={16} /> : <PlusGlyph className="w-4 h-4" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-fg-secondary">{adding ? 'Adding' : 'Add a track'}</span>
              {addTrouble && <span className="block truncate text-xs text-danger">{addTrouble}</span>}
            </span>
          </button>
          <input
            ref={picker}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={event => {
              void take(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </li>
      )}
    </ul>
  )
}
