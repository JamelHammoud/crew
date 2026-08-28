import { memo, useCallback, useRef, useState, type CSSProperties } from 'react'
import { FolderGlyph, LinkGlyph, PencilGlyph, PopOutGlyph, TrashGlyph, XCircleGlyph } from '../../icons'
import { toast } from '../../state/toast'
import Spinner from '../Spinner'
import { MenuItem, Popover } from '../Popover'
import { useScrollFade } from '../useScrollFade'
import PlaceFace from './PlaceFace'
import PlaceName from './PlaceName'
import ThreadRow from './ThreadRow'
import { samePlaceGroup, THREADS_SHOWN, type PlaceGroupProps } from './placeItems'

function PlaceGroup({
  place,
  here,
  busy,
  stoppable,
  threads,
  openThreadIds,
  onOpen,
  onOpenWindow,
  onOpenThread,
  onStop,
  onRename,
  onForget,
  take,
  dragged
}: PlaceGroupProps) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const [naming, setNaming] = useState(false)
  const rows = useRef<HTMLDivElement | null>(null)
  useScrollFade(rows)
  const scrolls = threads.length > THREADS_SHOWN

  const folder = place.project?.folder ?? place.join?.folder ?? ''

  const openThread = useCallback((threadId: string) => onOpenThread(place, threadId, false), [onOpenThread, place])
  const openThreadToRight = useCallback(
    (threadId: string) => onOpenThread(place, threadId, true),
    [onOpenThread, place]
  )

  return (
    <div
      data-reorder={place.key}
      className={`flex flex-col gap-0.5 transition-opacity duration-150 ${
        here ? 'opacity-100' : 'opacity-45 hover:opacity-100 focus-within:opacity-100'
      }`}
    >
      <button
        onPointerDown={take(place.key)}
        onClick={() => {
          if (!dragged()) onOpen(place)
        }}
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }}
        aria-current={here ? 'true' : undefined}
        className={`w-full rounded-xl px-2 py-1.5 flex items-center gap-2 text-left cursor-grab active:cursor-grabbing transition-[color,background-color,scale] duration-150 hover:bg-fg/[0.06] active:scale-[0.99] ${
          here ? 'text-fg' : 'text-fg/70'
        }`}
      >
        <PlaceFace place={place} lit={here} />
        {busy && <Spinner size={13} className="text-fg/45" />}
      </button>
      <div
        ref={rows}
        style={scrolls ? ({ '--rail-rows': THREADS_SHOWN } as CSSProperties) : undefined}
        className={
          threads.length === 0
            ? 'contents'
            : `flex flex-col gap-0.5 ${
                scrolls ? 'rail-threads scroll-fade overflow-y-auto overscroll-contain no-scrollbar' : ''
              }`
        }
      >
        {threads.map(thread => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            open={openThreadIds.includes(thread.id)}
            here={here}
            placeKey={place.key}
            onOpen={openThread}
            onOpenToRight={openThreadToRight}
          />
        ))}
      </div>
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined} className="min-w-44">
        <MenuItem
          icon={<PopOutGlyph className="w-4 h-4" />}
          label="Open in new window"
          onClick={() => {
            setMenuAt(null)
            onOpenWindow(place)
          }}
        />
        {folder && (
          <MenuItem
            icon={<FolderGlyph className="w-4 h-4" />}
            label="Show in folder"
            onClick={() => {
              setMenuAt(null)
              void window.crew.revealFile(folder).then(opened => {
                if (!opened) toast.fail('That folder is not there any more', { key: 'show-folder' })
              })
            }}
          />
        )}
        <MenuItem
          icon={<PencilGlyph className="w-4 h-4" />}
          label="Rename"
          onClick={() => {
            setMenuAt(null)
            setNaming(true)
          }}
        />
        {place.join && (
          <MenuItem
            icon={<LinkGlyph className="w-4 h-4" />}
            label="Copy link"
            onClick={() => {
              const link = place.join?.link
              setMenuAt(null)
              if (!link) return
              void navigator.clipboard.writeText(link).then(() => {
                toast.done('Link copied', { key: 'join-link' })
              })
            }}
          />
        )}
        {stoppable && (
          <MenuItem
            icon={<XCircleGlyph className="w-4 h-4" />}
            label="Stop"
            onClick={() => {
              setMenuAt(null)
              onStop(place)
            }}
          />
        )}
        <MenuItem
          icon={<TrashGlyph className="w-4 h-4" />}
          label="Remove"
          danger
          onClick={() => {
            setMenuAt(null)
            onForget(place)
          }}
        />
      </Popover>
      <PlaceName
        open={naming}
        given={place.given}
        name={place.nickname ?? ''}
        onClose={() => setNaming(false)}
        onSubmit={name => onRename(place, name)}
      />
    </div>
  )
}

export default memo(PlaceGroup, samePlaceGroup)
