import { useEffect, useRef } from 'react'
import { useBrowser, type BrowserTab } from '../state/browser'

const views = new Map<string, WebviewElement>()

// A pdf is drawn by the reader the browser carries, and a view that has not
// been told so hands the file to the machine rather than showing it, which is a
// panel that opens on nothing. React drops a boolean it does not know instead of
// writing it, so it goes on as the empty string an attribute that is simply
// there is held as.
const PLUGINS = { plugins: '' } as unknown as { plugins: boolean }

export function viewFor(id: string): WebviewElement | null {
  return views.get(id) ?? null
}

export default function BrowserTabView({ tab, active }: { tab: BrowserTab; active: boolean }) {
  const ref = useRef<WebviewElement>(null)

  useEffect(() => {
    const view = ref.current
    if (!view) return
    views.set(tab.id, view)
    const update = useBrowser.getState().updateTab
    const sync = () =>
      update(tab.id, {
        url: view.getURL(),
        canGoBack: view.canGoBack(),
        canGoForward: view.canGoForward()
      })
    const onTitle = (event: Event) => update(tab.id, { title: (event as Event & { title: string }).title })
    const onFavicon = (event: Event) =>
      update(tab.id, { favicon: (event as Event & { favicons: string[] }).favicons[0] ?? null })
    const onStart = () => update(tab.id, { loading: true })
    const onStop = () => {
      update(tab.id, { loading: false })
      sync()
    }
    view.addEventListener('did-navigate', sync)
    view.addEventListener('did-navigate-in-page', sync)
    view.addEventListener('page-title-updated', onTitle)
    view.addEventListener('page-favicon-updated', onFavicon)
    view.addEventListener('did-start-loading', onStart)
    view.addEventListener('did-stop-loading', onStop)
    return () => {
      views.delete(tab.id)
      view.removeEventListener('did-navigate', sync)
      view.removeEventListener('did-navigate-in-page', sync)
      view.removeEventListener('page-title-updated', onTitle)
      view.removeEventListener('page-favicon-updated', onFavicon)
      view.removeEventListener('did-start-loading', onStart)
      view.removeEventListener('did-stop-loading', onStop)
    }
  }, [tab.id])

  useEffect(() => {
    const view = ref.current
    if (!view || typeof view.getURL !== 'function' || typeof view.loadURL !== 'function' || !tab.initialUrl) return
    if (view.getURL() === tab.initialUrl) return
    void view.loadURL(tab.initialUrl).catch(() => undefined)
  }, [tab.initialUrl])

  // Asking for a page that is already open loads it again. The src has not
  // changed, so nothing about the tag would move on its own, and a page shown
  // after an edit would stand at what it was before it.
  useEffect(() => {
    if (tab.generation === 0) return
    try {
      ref.current?.reload()
    } catch {
      // The view is not attached yet, and its src is already the new page.
    }
  }, [tab.generation])

  return (
    <webview
      ref={ref}
      src={tab.initialUrl}
      {...PLUGINS}
      className="absolute inset-0 w-full h-full"
      style={{ visibility: active ? 'visible' : 'hidden' }}
    />
  )
}
