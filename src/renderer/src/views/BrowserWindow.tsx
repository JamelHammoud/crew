import BrowserPanel from '../components/BrowserPanel'
import { browserTabLabel } from '../components/BrowserTabMark'
import Toaster from '../components/Toaster'
import { useBrowser } from '../state/browser'
import { useWindowName } from '../state/windowName'

export default function BrowserWindow() {
  const tab = useBrowser(s => s.tabs.find(one => one.id === s.activeTabId))

  useWindowName(tab ? browserTabLabel(tab) : '')

  return (
    <div data-browser-window className="h-full relative bg-ink-900">
      <BrowserPanel standalone />
      <Toaster />
    </div>
  )
}
