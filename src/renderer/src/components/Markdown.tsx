import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useBrowser } from '../state/browser'
import { linkifyFiles, parseFileRef, statPaths } from './fileLinks'

export default function Markdown({ text }: { text: string }) {
  const [resolved, setResolved] = useState(0)
  const { html, unknown } = useMemo(() => {
    const container = document.createElement('div')
    container.innerHTML = DOMPurify.sanitize(marked.parse(text, { async: false }) as string)
    const unknown = linkifyFiles(container)
    return { html: container.innerHTML, unknown }
  }, [text, resolved])

  useEffect(() => {
    if (unknown.length === 0) return
    let alive = true
    void statPaths(unknown).then(found => alive && found && setResolved(count => count + 1))
    return () => {
      alive = false
    }
  }, [unknown])

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest('a')
    if (!link) return
    event.preventDefault()
    if (link.dataset.path !== undefined) {
      const line = link.dataset.line ? parseInt(link.dataset.line, 10) : null
      useBrowser.getState().openFile(link.dataset.path, line)
      return
    }
    const href = link.getAttribute('href') ?? ''
    if (/^https?:/i.test(href)) {
      useBrowser.getState().openUrl(href)
      return
    }
    if (/^mailto:/i.test(href)) {
      void window.crew.openExternal(href)
      return
    }
    const ref = parseFileRef(decodeURIComponent(href))
    if (ref) useBrowser.getState().openFile(ref.path, ref.line)
  }

  return <div className="md" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}
