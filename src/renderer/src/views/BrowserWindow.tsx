import BrowserPanel from '../components/BrowserPanel'
import Toaster from '../components/Toaster'

export default function BrowserWindow() {
  return (
    <div data-browser-window className="h-full relative bg-ink-900">
      <BrowserPanel standalone />
      <Toaster />
    </div>
  )
}
