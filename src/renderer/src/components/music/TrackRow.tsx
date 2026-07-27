import type { MusicItem, MusicPlaylist } from '../../../../shared/music'
import Bars from './Bars'
import Cover from './Cover'
import { clock } from './say'
import TrackMenu from './TrackMenu'

// One track, and the whole row is the way to play it. What the row can do sits
// at the end of it in a slot that is always there, so nothing moves when the
// pointer arrives.
export default function TrackRow({
  item,
  on,
  playing,
  onPlay,
  within
}: {
  item: MusicItem
  on: boolean
  playing: boolean
  onPlay: () => void
  within?: MusicPlaylist
}) {
  return (
    <li
      className={`group h-14 px-2 rounded-2xl flex items-center gap-3 transition-colors duration-150 ${
        on ? 'bg-fg/[0.07]' : 'hover:bg-fg/[0.04]'
      }`}
    >
      <button onClick={onPlay} aria-pressed={on} className="flex-1 min-w-0 h-full flex items-center gap-3 text-left">
        <Cover item={item} size={40} playing={on && playing} className="w-10 h-10 shrink-0 rounded-[10px]">
          {on && (
            // A scrim under the bars, because a cover can be any color and white
            // on yellow is not a bar at all.
            <span className="absolute inset-0 flex items-end p-[7px] text-white bg-gradient-to-t from-black/55 to-transparent">
              <Bars count={4} className="h-3/4 w-full justify-between" barClassName="w-[3px]" />
            </span>
          )}
        </Cover>
        <span className="flex-1 min-w-0">
          <span className={`block truncate text-sm ${on ? 'text-fg font-medium' : 'text-fg-secondary'}`}>
            {item.name}
          </span>
          <span className="block truncate text-xs text-fg-muted">
            {item.by ? `${item.mood}, from ${item.by}` : item.mood}
          </span>
        </span>
      </button>
      <TrackMenu item={item} within={within} />
      <span className="shrink-0 text-xs tabular-nums text-fg-faint">{clock(item.seconds)}</span>
    </li>
  )
}
