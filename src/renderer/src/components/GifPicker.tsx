import { useEffect, useRef, useState } from 'react'
import { SearchGlyph } from '../icons'
import { gifsReady, searchGifs, trendingGifs, type Gif } from './gifs'
import Skeleton from './Skeleton'
import Spinner from './Spinner'

const COLUMNS = 2
const TYPING = 250
const NEAR_END = 240

// Tiles are laid out by how tall they will come out rather than dealt round the
// columns in turn, so two portrait GIFs never stack under one another and leave
// the other column short. The ratio is all it takes: the tiles are the same
// width, so height is height over width.
function columns(gifs: Gif[]): Gif[][] {
  const held: Gif[][] = Array.from({ length: COLUMNS }, () => [])
  const tall = new Array(COLUMNS).fill(0)
  for (const gif of gifs) {
    const at = tall.indexOf(Math.min(...tall))
    held[at].push(gif)
    tall[at] += gif.height / gif.width
  }
  return held
}

function Tile({ gif, sending, onPick }: { gif: Gif; sending: boolean; onPick: () => void }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Send ${gif.title}`}
      className="relative block w-full overflow-hidden rounded-xl transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.02] active:scale-95"
      style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
    >
      {!loaded && (
        <span className="absolute inset-0">
          <Skeleton />
        </span>
      )}
      <img
        src={gif.preview}
        alt={gif.title}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`block h-full w-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-fg/10" />
      {sending && (
        <span className="absolute inset-0 flex items-center justify-center bg-ink-900/60">
          <Spinner size={20} className="text-fg" />
        </span>
      )}
    </button>
  )
}

export default function GifPicker({
  onPick,
  className = 'h-[420px] w-[380px]'
}: {
  onPick: (gif: Gif) => Promise<void>
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const asked = useRef(0)
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<Gif[]>([])
  const [page, setPage] = useState(0)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(gifsReady())
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [trouble, setTrouble] = useState(false)

  const wanted = query.trim()

  useEffect(() => {
    if (!gifsReady()) return
    const token = ++asked.current
    setLoading(true)
    setFailed(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    const timer = setTimeout(() => {
      const run = wanted ? searchGifs(wanted) : trendingGifs()
      run
        .then(result => {
          if (asked.current !== token) return
          setGifs(result.gifs)
          setPage(result.page)
          setMore(result.more)
          setLoading(false)
        })
        .catch(() => {
          if (asked.current !== token) return
          setFailed(true)
          setLoading(false)
        })
    }, wanted ? TYPING : 0)
    return () => clearTimeout(timer)
  }, [wanted])

  const onScroll = () => {
    const scroller = scrollRef.current
    if (!scroller || !more || loading || !gifsReady()) return
    if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > NEAR_END) return
    const token = ++asked.current
    setMore(false)
    const run = wanted ? searchGifs(wanted, page + 1) : trendingGifs(page + 1)
    run
      .then(result => {
        if (asked.current !== token) return
        setGifs(held => [...held, ...result.gifs])
        setPage(result.page)
        setMore(result.more)
      })
      .catch(() => {})
  }

  // One GIF that would not come down says so on a line of its own. The grid
  // behind it arrived and is still good, so replacing it with the failure would
  // take away the other GIFs over the one that went wrong.
  const send = (gif: Gif) => {
    if (sending) return
    setSending(gif.id)
    setTrouble(false)
    void onPick(gif)
      .catch(() => setTrouble(true))
      .finally(() => setSending(null))
  }

  const note = !gifsReady()
    ? 'GIFs are not set up yet'
    : failed
      ? 'GIFs are not loading right now'
      : !loading && gifs.length === 0
        ? 'No GIFs found'
        : null

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <SearchGlyph className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/45" />
          <input
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search GIFs"
            className="h-9 w-full rounded-full bg-fg/6 pl-9 pr-3 text-sm text-fg outline-none transition-colors placeholder:text-fg/40 focus:bg-fg/10"
          />
        </div>
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {note ? (
          <p className="flex h-full items-center justify-center text-sm text-fg/45">{note}</p>
        ) : (
          <div className="flex gap-2">
            {loading
              ? Array.from({ length: COLUMNS }, (_, column) => (
                  <div key={column} className="flex min-w-0 flex-1 flex-col gap-2">
                    {[1.1, 0.7, 1.35, 0.85].map((ratio, row) => (
                      <span key={row} className="relative block w-full" style={{ aspectRatio: `1 / ${ratio}` }}>
                        <Skeleton className="h-full w-full rounded-xl" />
                      </span>
                    ))}
                  </div>
                ))
              : columns(gifs).map((held, column) => (
                  <div key={column} className="flex min-w-0 flex-1 flex-col gap-2">
                    {held.map(gif => (
                      <Tile key={gif.id} gif={gif} sending={sending === gif.id} onPick={() => send(gif)} />
                    ))}
                  </div>
                ))}
          </div>
        )}
      </div>
      {trouble && (
        <p className="border-t border-fg/8 px-4 py-2.5 text-sm text-fg/45">That GIF would not send</p>
      )}
    </div>
  )
}
