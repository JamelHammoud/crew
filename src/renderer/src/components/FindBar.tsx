import { ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { useEffect, useRef, useState, type RefObject } from 'react'

// Per-char lowercase that never changes string length, so match offsets stay
// valid UTF-16 offsets into the original text nodes (e.g. 'İ'.toLowerCase() is 2 chars).
const fold = (s: string): string =>
  Array.from(s, ch => {
    const lower = ch.toLowerCase()
    return lower.length === ch.length ? lower : ch
  }).join('')

function computeMatches(root: HTMLElement, query: string): Range[] {
  const needle = fold(query)
  if (!needle) return []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  const starts: number[] = []
  let haystack = ''
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push(n as Text)
    starts.push(haystack.length)
    haystack += fold((n as Text).data)
  }
  const ranges: Range[] = []
  let node = 0
  const place = (offset: number): [Text, number] => {
    while (node + 1 < nodes.length && starts[node + 1] <= offset) node++
    return [nodes[node], offset - starts[node]]
  }
  for (
    let at = haystack.indexOf(needle);
    at !== -1 && ranges.length < 500;
    at = haystack.indexOf(needle, at + needle.length)
  ) {
    const range = document.createRange()
    range.setStart(...place(at))
    range.setEnd(...place(at + needle.length))
    ranges.push(range)
  }
  return ranges
}

export default function FindBar({
  containerRef,
  scrollerRef
}: {
  containerRef: RefObject<HTMLElement | null>
  scrollerRef: RefObject<HTMLElement | null>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Range[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const shouldScroll = useRef(false)
  const openRef = useRef(open)
  openRef.current = open
  const matchesRef = useRef(matches)
  matchesRef.current = matches

  const step = (dir: 1 | -1) => {
    const count = matchesRef.current.length
    if (count === 0) return
    shouldScroll.current = true
    setActive(prev => (prev + dir + count) % count)
  }
  const stepRef = useRef(step)
  stepRef.current = step

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setOpen(true)
        requestAnimationFrame(() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        })
        return
      }
      if (!openRef.current) return
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        stepRef.current(e.shiftKey ? -1 : 1)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    if (!open) {
      setMatches([])
      setActive(0)
      return
    }
    const root = containerRef.current
    if (!root) return
    let timer: number | null = null
    const run = (reset: boolean) => {
      const next = computeMatches(root, query)
      setMatches(next)
      setActive(prev => (next.length === 0 ? 0 : reset ? 0 : Math.min(prev, next.length - 1)))
    }
    shouldScroll.current = true
    run(true)
    const observer = new MutationObserver(() => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => run(false), 150)
    })
    observer.observe(root, { subtree: true, childList: true, characterData: true })
    return () => {
      observer.disconnect()
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [open, query, containerRef])

  useEffect(() => {
    const registry = CSS.highlights
    if (!registry) return
    if (matches.length === 0) return
    const current = new Highlight(matches[Math.min(active, matches.length - 1)])
    current.priority = 1
    registry.set('find-match', new Highlight(...matches))
    registry.set('find-match-active', current)
    return () => {
      registry.delete('find-match')
      registry.delete('find-match-active')
    }
  }, [matches, active])

  useEffect(() => {
    if (matches.length === 0 || !shouldScroll.current) return
    shouldScroll.current = false
    const scroller = scrollerRef.current
    if (!scroller) return
    const rect = matches[Math.min(active, matches.length - 1)].getBoundingClientRect()
    const view = scroller.getBoundingClientRect()
    if (rect.top < view.top + 110 || rect.bottom > view.bottom - 60) {
      scroller.scrollTop += rect.top + rect.height / 2 - (view.top + view.height / 2)
    }
  }, [matches, active, scrollerRef])

  if (!open) return null
  return (
    <div className="glass fixed top-[78px] right-8 z-40 flex w-80 items-center gap-0.5 rounded-full pl-3 pr-1.5 py-1.5 animate-pop">
      <MagnifyingGlassIcon className="w-4 h-4 text-fg-muted shrink-0 mr-1.5" />
      <input
        ref={inputRef}
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            step(e.shiftKey ? -1 : 1)
          }
        }}
        placeholder="Find in page"
        className="flex-1 min-w-0 bg-transparent text-sm text-fg placeholder:text-fg-faint outline-none"
      />
      {query && (
        <span className="text-xs tabular-nums text-fg-muted px-1 shrink-0">
          {matches.length === 0 ? '0/0' : `${active + 1}/${matches.length}`}
        </span>
      )}
      <button
        onClick={() => step(-1)}
        onMouseDown={e => e.preventDefault()}
        disabled={matches.length === 0}
        aria-label="Previous match"
        className="w-6 h-6 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/[0.08] transition-colors shrink-0 disabled:opacity-40 disabled:pointer-events-none"
      >
        <ChevronUpIcon className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => step(1)}
        onMouseDown={e => e.preventDefault()}
        disabled={matches.length === 0}
        aria-label="Next match"
        className="w-6 h-6 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/[0.08] transition-colors shrink-0 disabled:opacity-40 disabled:pointer-events-none"
      >
        <ChevronDownIcon className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setOpen(false)}
        aria-label="Close find"
        className="w-6 h-6 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/[0.08] transition-colors shrink-0"
      >
        <XMarkIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
