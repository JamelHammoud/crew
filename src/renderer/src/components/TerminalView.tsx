import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef } from 'react'
import { onMac } from '../state/platform'
import { useTheme } from '../state/theme'
import { useBrowser, type BrowserTab } from '../state/browser'
import { TERMINAL_FONT, terminalTheme } from './terminalTheme'

const shifted = (event: KeyboardEvent, letter: string): boolean =>
  event.ctrlKey && event.shiftKey && event.key.toLowerCase() === letter

// xterm works the terminal out from the box it was given, and a box with no
// size yet throws from deep inside it. Nothing is measured until there is
// something to measure against.
function fitTo(host: HTMLElement | null, fit: FitAddon | null): void {
  if (!host || !fit || host.clientWidth < 2 || host.clientHeight < 2) return
  fit.fit()
}

export default function TerminalView({ tab, active }: { tab: BrowserTab; active: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const theme = useTheme()
  const themeRef = useRef(theme)
  themeRef.current = theme

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: TERMINAL_FONT,
      fontSize: 13,
      lineHeight: 1.35,
      macOptionIsMeta: false,
      scrollback: 5000,
      theme: terminalTheme(themeRef.current)
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon((_event, url) => useBrowser.getState().openUrl(url)))
    // On a Mac the clipboard keys are the app menu's, and xterm answers the
    // copy and paste events they raise. Everywhere else the terminal keys are
    // the shifted pair, because plain Ctrl+C has to reach the shell.
    term.attachCustomKeyEventHandler(event => {
      if (event.type !== 'keydown' || onMac()) return true
      if (shifted(event, 'c') && term.hasSelection()) {
        void navigator.clipboard.writeText(term.getSelection()).catch(() => undefined)
        return false
      }
      if (shifted(event, 'v')) {
        void navigator.clipboard
          .readText()
          .then(text => text && window.crew.writeTerminal(tab.id, text))
          .catch(() => undefined)
        return false
      }
      return true
    })
    term.open(host)
    termRef.current = term
    fitRef.current = fit

    term.onData(data => window.crew.writeTerminal(tab.id, data))
    term.onResize(size => window.crew.resizeTerminal(tab.id, size))
    term.onTitleChange(title => useBrowser.getState().updateTab(tab.id, { title }))

    const offData = window.crew.onTerminalData((id, chunk) => {
      if (id === tab.id) term.write(chunk)
    })
    const offExit = window.crew.onTerminalExit(id => {
      if (id !== tab.id) return
      term.options.cursorBlink = false
      term.write('\r\n\x1b[90m[Process completed]\x1b[0m\r\n')
    })
    window.crew.openTerminal(tab.id, { cols: term.cols, rows: term.rows })

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => fitTo(host, fit))
    observer?.observe(host)

    return () => {
      observer?.disconnect()
      offData()
      offExit()
      window.crew.closeTerminal(tab.id)
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [tab.id])

  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = terminalTheme(theme)
  }, [theme])

  useEffect(() => {
    if (!active) return
    fitTo(hostRef.current, fitRef.current)
    termRef.current?.focus()
  }, [active])

  return (
    <div
      data-terminal={tab.id}
      onMouseDown={() => termRef.current?.focus()}
      className="absolute inset-0 bg-ink-900 p-3"
      style={{ visibility: active ? 'visible' : 'hidden' }}
    >
      <div ref={hostRef} className="w-full h-full" />
    </div>
  )
}
