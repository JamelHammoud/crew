import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useBrowser } from '../state/browser'
import { useCustomEmoji } from './customEmojiSheet'
import { emojifyHtml } from './emojiHtml'
import { linkifyFiles, locatePaths, openHref } from './fileLinks'
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

// A picture the page points at by a path nothing in the app can reach, handed
// over as itself. It lands on the drawn image rather than on the words, so a
// path written inside a code fence is left as it was typed.
function swapImages(container: HTMLElement, images: Record<string, string>) {
  for (const image of Array.from(container.querySelectorAll('img'))) {
    const found = images[image.getAttribute('src') ?? '']
    if (found) image.setAttribute('src', found)
  }
}

export default function Markdown({
  text,
  className = '',
  stream = false,
  images,
  breaks = true
}: {
  text: string
  className?: string
  stream?: boolean
  images?: Record<string, string>
  // A line ending is a line break in something somebody typed, and nothing at
  // all in a file, where a paragraph is wrapped as it was written and only a
  // blank line ends it.
  breaks?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const drawn = useRef(false)
  const sheet = useCustomEmoji()
  const [resolved, setResolved] = useState(0)
  const { page, unknown } = useMemo(() => {
    const container = document.createElement('div')
    container.innerHTML = DOMPurify.sanitize(marked.parse(text, { async: false, breaks }) as string)
    markTasks(container)
    wrapTables(container)
    if (images) swapImages(container, images)
    const unknown = linkifyFiles(container)
    emojifyHtml(container)
    return { page: container, unknown }
    // The sheet of the crew's own is read while this is drawn, so a name written
    // before they had that emoji is a picture the moment it arrives.
  }, [text, resolved, images, breaks, sheet])

  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    if (drawn.current) morph(el, page, stream)
    else {
      el.replaceChildren(...[...page.cloneNode(true).childNodes])
      drawn.current = true
    }
  }, [page, stream])

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
    openHref(link.getAttribute('href') ?? '')
  }

  return <div ref={host} className={`md select-text ${className}`} onClick={onClick} />
}
