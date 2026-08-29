import { MINIMIZE_AT, useBrowser } from '../state/browser'
import BrowserPanel from './BrowserPanel'
import { useColumnResize } from './useColumnResize'

export default function SidePanel() {
  const open = useBrowser(s => s.open)
  const fullScreen = useBrowser(s => s.fullScreen)
  const width = useBrowser(s => s.width)
  const { dragging, startResize } = useColumnResize(
    width,
    asked => {
      const browser = useBrowser.getState()
      if (asked < MINIMIZE_AT) {
        if (browser.open) browser.closePanel()
        return
      }
      if (!browser.open) browser.openPanel()
      browser.setWidth(asked)
    },
    () => useBrowser.getState().resetWidth()
  )

  return (
    <div
      data-browser-fullscreen={open && fullScreen ? '' : undefined}
      className={
        open && fullScreen
          ? 'app-no-drag fixed inset-0 z-[60] overflow-hidden bg-ink-900'
          : `relative shrink-0 overflow-hidden bg-ink-900 ${open ? 'border-l border-ink-700' : ''} ${
              dragging ? '' : 'transition-[width] duration-200'
            }`
      }
      style={open && fullScreen ? undefined : { width: open ? width : 0 }}
    >
      <div className="absolute inset-y-0 left-0 h-full" style={{ width: open && fullScreen ? '100%' : width }}>
        <BrowserPanel />
      </div>
      {open && !fullScreen && (
        <div
          onPointerDown={startResize}
          className="absolute inset-y-0 left-0 w-1.5 z-10 cursor-col-resize hover:bg-fg/10 transition-colors"
        />
      )}
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </div>
  )
}
