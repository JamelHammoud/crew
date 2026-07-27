import type { ReactNode } from 'react'
import type { MusicItem } from '../../../../shared/music'
import Bars from './Bars'
import { clock } from './clock'
import Cover from './Cover'

// What a row can do sits beside the row rather than inside it. A button within a
// button is not a button, and a menu opened from one would hand its clicks back
// to the row underneath, which would put the track on while you were choosing
// where to file it.
export const rowAction =
  'w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg-faint transition-all duration-150 hover:text-fg hover:bg-fg/10 active:scale-95'

export const rowActionQuiet = `${rowAction} opacity-0 group-hover:opacity-100 focus-visible:opacity-100`

export default function TrackRow({
  item,
  on,
  playing,
  onPlay,
  actions
}: {
  item: MusicItem
  on: boolean
  playing: boolean
  onPlay: () => void
  actions?: ReactNode
}) {
  return (
    <li
      className={`group h-14 px-2 rounded-2xl flex items-center gap-3 transition-colors duration-150 ${
        on ? 'bg-fg/[0.06]' : 'hover:bg-fg/[0.04]'
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
      <span className="shrink-0 w-9 text-right text-xs tabular-nums text-fg-faint">{clock(item.seconds)}</span>
      {actions}
    </li>
  )
}
