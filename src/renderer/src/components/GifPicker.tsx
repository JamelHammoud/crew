import { useEffect, useRef, useState } from 'react'
import { gifsReady, searchGifs, trendingGifs, type Gif } from './gifs'
import InsetRing from './InsetRing'
import SearchField from './SearchField'
import Skeleton from './Skeleton'
import Spinner from './Spinner'

const COLUMNS = 2
const TYPING = 250
const NEAR_END = 240
const HINT = 'Picking one sends it'
const WAITING = [
  [0.78, 1.24, 0.86, 1.12],
  [1.16, 0.82, 1.3, 0.72]
]

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

function Tile({
  gif,
  sending,
  onPick,
  onShow
}: {
  gif: Gif
  sending: boolean
  onPick: () => void
  onShow: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <button
      type="button"
      onClick={onPick}
      onPointerEnter={onShow}
      onFocus={onShow}
      aria-label={`Send ${gif.title}`}
      className="group relative block w-full cursor-pointer overflow-hidden rounded-tile bg-fg/[0.04] transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97]"
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
      <InsetRing className="ring-1 ring-fg/10 ring-inset transition-[box-shadow] duration-150 group-hover:ring-fg/30" />
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
  onBack,
  className = 'h-[420px] w-[380px]'
}: {
  onPick: (gif: Gif) => Promise<void>
  onBack?: () => void
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
  const [named, setNamed] = useState<string | null>(null)

  const wanted = query.trim()

  useEffect(() => {
    if (!gifsReady()) return
    const token = ++asked.current
    setLoading(true)
    setFailed(false)
    setTrouble(false)
    setNamed(null)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    const timer = setTimeout(
      () => {
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
      },
      wanted ? TYPING : 0
    )
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
      .catch(() => {
        if (asked.current === token) setMore(true)
      })
  }

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

  const foot = trouble ? 'That GIF would not send' : (named ?? (note ? '' : HINT))

  return (
    <div className={`flex flex-col ${className}`}>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search GIFs"
        onBack={onBack}
        backLabel="Back to the menu"
      />
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onPointerLeave={() => setNamed(null)}
        className="min-h-0 flex-1 overflow-y-auto p-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {note ? (
          <p className="flex h-full items-center justify-center text-sm text-fg/40">{note}</p>
        ) : (
          <div className="flex gap-2.5">
            {loading
              ? WAITING.map((ratios, column) => (
                  <div key={column} className="flex min-w-0 flex-1 flex-col gap-2.5">
                    {ratios.map((ratio, row) => (
                      <span key={row} className="relative block w-full" style={{ aspectRatio: `1 / ${ratio}` }}>
                        <Skeleton className="h-full w-full rounded-tile" />
                      </span>
                    ))}
                  </div>
                ))
              : columns(gifs).map((held, column) => (
                  <div key={column} className="flex min-w-0 flex-1 flex-col gap-2.5">
                    {held.map(gif => (
                      <Tile
                        key={gif.id}
                        gif={gif}
                        sending={sending === gif.id}
                        onPick={() => send(gif)}
                        onShow={() => setNamed(gif.title)}
                      />
                    ))}
                  </div>
                ))}
          </div>
        )}
      </div>
      <div className="flex h-11 shrink-0 items-center border-t border-fg/[0.06] px-4">
        <p className={`truncate text-sm ${trouble ? 'text-fg/70' : 'text-fg/45'}`}>{foot}</p>
      </div>
    </div>
  )
}
