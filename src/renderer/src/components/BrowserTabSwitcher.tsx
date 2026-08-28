import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { CheckGlyph, CloseGlyph, MenuGlyph } from '../icons'
import { useBrowser, type BrowserTab } from '../state/browser'
import BrowserTabMark, { browserTabDetail, browserTabLabel, browserTabSearchText } from './BrowserTabMark'
import { Popover } from './Popover'
import SearchField from './SearchField'
import Tooltip from './Tooltip'

const buttonClass =
  'w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95'

export default function BrowserTabSwitcher({ tabs, activeTabId }: { tabs: BrowserTab[]; activeTabId: string | null }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const found = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return needle ? tabs.filter(tab => browserTabSearchText(tab).includes(needle)) : tabs
  }, [query, tabs])

  useEffect(() => {
    setCursor(
      Math.max(
        0,
        found.findIndex(tab => tab.id === activeTabId)
      )
    )
  }, [activeTabId, found, open])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLocaleLowerCase() === 'a' && event.shiftKey && (event.metaKey || event.ctrlKey)) {
        if (tabs.length < 2) return
        event.preventDefault()
        setQuery('')
        setOpen(true)
        return
      }
      if (event.key !== 'Tab' || !event.ctrlKey || tabs.length < 2) return
      event.preventDefault()
      const at = Math.max(
        0,
        tabs.findIndex(tab => tab.id === activeTabId)
      )
      const by = event.shiftKey ? -1 : 1
      const next = (at + by + tabs.length) % tabs.length
      setOpen(false)
      useBrowser.getState().selectTab(tabs[next]!.id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTabId, tabs])

  if (tabs.length < 2) return null

  const choose = (tab: BrowserTab) => {
    useBrowser.getState().selectTab(tab.id)
    setOpen(false)
  }

  const onSearchKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor(value => (value + 1) % Math.max(1, found.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor(value => (value - 1 + Math.max(1, found.length)) % Math.max(1, found.length))
    } else if (event.key === 'Enter' && found[cursor]) {
      event.preventDefault()
      choose(found[cursor]!)
    }
  }

  return (
    <span className="app-no-drag shrink-0 flex">
      <Tooltip label={`Search ${tabs.length} tabs`} disabled={open}>
        <button
          onClick={() => {
            if (!open) setQuery('')
            setOpen(!open)
          }}
          aria-label="Search tabs"
          aria-expanded={open}
          className={`${buttonClass} ${open ? 'text-fg bg-fg/[0.06]' : ''}`}
        >
          <MenuGlyph className="w-4 h-4" />
        </button>
      </Tooltip>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        flush
        maxHeight={440}
        scroll={false}
        className="w-80 max-w-[calc(100vw-16px)]"
      >
        <div className="flex max-h-[inherit] flex-col overflow-hidden">
          <SearchField value={query} onChange={setQuery} onKeyDown={onSearchKeys} placeholder="Search tabs" />
          <div data-tab-results className="overflow-y-auto p-1.5">
            {found.map((tab, index) => {
              const detail = browserTabDetail(tab)
              const label = browserTabLabel(tab)
              return (
                <div
                  key={tab.id}
                  data-tab-result={tab.id}
                  data-highlighted={index === cursor ? '' : undefined}
                  className="group relative flex min-w-0 items-center rounded-xl px-3 py-2 text-fg/70 transition-colors hover:bg-fg/5 data-highlighted:bg-fg/5"
                  onPointerEnter={() => setCursor(index)}
                  onClick={() => choose(tab)}
                >
                  <button
                    onClick={event => {
                      event.stopPropagation()
                      choose(tab)
                    }}
                    aria-label={`Open ${label}`}
                    className="absolute inset-0 rounded-xl active:scale-[0.99]"
                  />
                  <span className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      <BrowserTabMark tab={tab} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">{label}</span>
                      {detail && detail !== label && (
                        <span className="mt-0.5 block truncate text-xs text-fg/40">{detail}</span>
                      )}
                    </span>
                    {tab.id === activeTabId && (
                      <CheckGlyph className="h-4 w-4 shrink-0 text-fg transition-opacity group-hover:opacity-0 group-focus-within:opacity-0" />
                    )}
                  </span>
                  <button
                    onClick={event => {
                      event.stopPropagation()
                      useBrowser.getState().closeTab(tab.id)
                      if (tabs.length === 2) setOpen(false)
                    }}
                    aria-label={`Close ${label}`}
                    className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-fg/40 opacity-0 transition-[background-color,color,opacity,transform] hover:bg-fg/10 hover:text-fg group-hover:opacity-100 focus:opacity-100 active:scale-90"
                  >
                    <CloseGlyph className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
            {found.length === 0 && <div className="px-3 py-8 text-center text-sm text-fg/45">No tabs found</div>}
          </div>
        </div>
      </Popover>
    </span>
  )
}
