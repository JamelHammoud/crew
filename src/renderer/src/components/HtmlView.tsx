import { useEffect, useState } from 'react'
import Spinner from './Spinner'

// A page read as the page it is written to be. The words in hand are what is
// drawn, so an edit typed in the text is on the page, and everything the page
// points at beside itself is read off the folder it really lives in.
export default function HtmlView({
  id,
  path,
  text,
  partial = false
}: {
  id: string
  path: string
  text: string
  partial?: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setUrl(null)
    setFailed(false)
    window.crew
      .previewHtml(id, path, partial ? null : text)
      .then(made => {
        if (!alive) return
        if (made) setUrl(made)
        else setFailed(true)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [id, path, text, partial])

  useEffect(() => {
    return () => {
      void window.crew.dropPreview(id)
    }
  }, [id])

  return (
    <div data-html-page className="absolute inset-0 bg-ink-900">
      {!url && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size={20} className="text-fg-muted" />
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <p className="text-sm text-fg-muted">Could not show this page</p>
        </div>
      )}
      {url && <webview key={url} src={url} className="absolute inset-0 w-full h-full" />}
      {url && partial && (
        <p className="glass select-none absolute bottom-3 left-3 px-3 py-1.5 rounded-full text-xs text-fg/70">
          Showing the beginning of this file
        </p>
      )}
    </div>
  )
}
