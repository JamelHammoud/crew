import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useBrowser } from '../state/browser'
import { emojifyHtml } from './emojiHtml'
import { linkifyFiles, locatePaths, parseFileRef, targetFor } from './fileLinks'
import { morph } from './mdMorph'

function markTasks(container: HTMLElement) {
  for (const box of Array.from(container.querySelectorAll('li > input[type="checkbox"]'))) {
    const item = box.parentElement
    if (!item) continue
    const mark = document.createElement('span')
    mark.className = 'md-check'
    if ((box as HTMLInputElement).checked) mark.dataset.checked = ''
    box.replaceWith(mark)
    item.classList.add('md-task')
    item.parentElement?.classList.add('md-tasks')
  }
}

function wrapTables(container: HTMLElement) {
  for (const table of Array.from(container.querySelectorAll('table'))) {
    if (table.parentElement?.classList.contains('table-scroll')) continue
    const scroll = document.createElement('div')
    scroll.className = 'table-scroll'
    table.replaceWith(scroll)
    scroll.appendChild(table)
  }
}

export default function Markdown({
  text,
  className = '',
  stream = false
}: {
  text: string
  className?: string
  stream?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const drawn = useRef(false)
  const [resolved, setResolved] = useState(0)
  const { html, unknown } = useMemo(() => {
    const container = document.createElement('div')
    container.innerHTML = DOMPurify.sanitize(marked.parse(text, { async: false, breaks: true }) as string)
    markTasks(container)
    wrapTables(container)
    const unknown = linkifyFiles(container)
    emojifyHtml(container)
    return { html: container.innerHTML, unknown }
  }, [text, resolved])

  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    if (drawn.current) morph(el, html, stream)
    else {
      el.innerHTML = html
      drawn.current = true
    }
  }, [html, stream])

  useEffect(() => {
    if (unknown.length === 0) return
    let alive = true
    void locatePaths(unknown).then(moved => alive && moved && setResolved(count => count + 1))
    return () => {
      alive = false
    }
  }, [unknown])

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest('a')
    if (!link) return
    event.preventDefault()
    event.stopPropagation()
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
    if (ref) useBrowser.getState().openFile(targetFor(ref.path), ref.line)
  }

  return <div ref={host} className={`md select-text ${className}`} onClick={onClick} />
}
