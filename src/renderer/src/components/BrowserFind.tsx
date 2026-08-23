import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDownGlyph, ChevronUpGlyph, CloseGlyph, SearchGlyph } from '../icons'
import { viewFor } from './BrowserTabView'

const BUTTON =
  'w-6 h-6 rounded-full flex items-center justify-center text-fg/70 hover:text-fg hover:bg-fg/[0.08] transition-colors shrink-0 disabled:opacity-40 disabled:pointer-events-none'

type Result = {
  active: number
  matches: number
}

export function BrowserFindButton({ open, disabled, onClick }: { open: boolean; disabled: boolean; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={open ? 'Close find' : 'Find in page'}
      aria-pressed={open}
      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all duration-150 hover:bg-fg/[0.06] active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
        open ? 'text-fg bg-fg/[0.06]' : 'text-fg-muted hover:text-fg'
      }`}
    >
      {open ? <CloseGlyph className="w-4 h-4" /> : <SearchGlyph className="w-4 h-4" />}
    </button>
  )
}

export default function BrowserFind({ tabId, focus, onClose }: { tabId: string; focus: number; onClose(): void }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Result>({ active: 0, matches: 0 })
  const input = useRef<HTMLInputElement>(null)
  const request = useRef<number | null>(null)
  const queryRef = useRef(query)
  queryRef.current = query

  const stop = () => {
    request.current = null
    setResult({ active: 0, matches: 0 })
    try {
      viewFor(tabId)?.stopFindInPage('clearSelection')
    } catch {}
  }

  const find = (next: string, forward = true, findNext = false) => {
    const view = viewFor(tabId)
    if (!next || !view) {
      stop()
      return
    }
    try {
      request.current = view.findInPage(next, { forward, findNext })
    } catch {}
  }

  const close = () => {
    stop()
    onClose()
  }

  useEffect(() => {
    const view = viewFor(tabId)
    if (!view) return
    const found = (event: Event) => {
      const found = event as Event & {
        result: { requestId: number; activeMatchOrdinal: number; matches: number }
      }
      if (request.current !== found.result.requestId) return
      setResult({ active: found.result.activeMatchOrdinal, matches: found.result.matches })
    }
    const loaded = () => {
      setResult({ active: 0, matches: 0 })
      find(queryRef.current)
    }
    view.addEventListener('found-in-page', found)
    view.addEventListener('did-stop-loading', loaded)
    return () => {
      view.removeEventListener('found-in-page', found)
      view.removeEventListener('did-stop-loading', loaded)
      try {
        view.stopFindInPage('clearSelection')
      } catch {}
    }
  }, [tabId])

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [focus])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    if (event.key === 'Enter' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'g')) {
      event.preventDefault()
      find(query, !event.shiftKey, true)
    }
  }

  return (
    <div className="glass absolute top-4 left-4 right-4 z-50 ml-auto flex max-w-80 items-center gap-0.5 rounded-full pl-3 pr-1.5 py-1.5 animate-pop">
      <SearchGlyph className="w-4 h-4 text-fg/45 shrink-0 mr-1.5" />
      <input
        ref={input}
        value={query}
        onChange={event => {
          const next = event.target.value
          setQuery(next)
          setResult({ active: 0, matches: 0 })
          find(next)
        }}
        onKeyDown={onKeyDown}
        placeholder="Find in page"
        aria-label="Find in page"
        className="flex-1 min-w-0 bg-transparent text-sm text-fg placeholder:text-fg/30 outline-none"
      />
      {query && (
        <span className="text-xs tabular-nums text-fg/45 px-1 shrink-0">
          {result.matches === 0 ? '0/0' : `${result.active}/${result.matches}`}
        </span>
      )}
      <button
        onClick={() => find(query, false, true)}
        onMouseDown={event => event.preventDefault()}
        disabled={!query || result.matches === 0}
        aria-label="Previous match"
        className={BUTTON}
      >
        <ChevronUpGlyph className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => find(query, true, true)}
        onMouseDown={event => event.preventDefault()}
        disabled={!query || result.matches === 0}
        aria-label="Next match"
        className={BUTTON}
      >
        <ChevronDownGlyph className="w-3.5 h-3.5" />
      </button>
      <button onClick={close} aria-label="Close find" className={BUTTON}>
        <CloseGlyph className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
