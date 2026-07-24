import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { MouseEvent } from 'react'
import { useBrowser } from '../state/browser'

export default function Markdown({ text }: { text: string }) {
  const html = DOMPurify.sanitize(marked.parse(text, { async: false }) as string)

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest('a')
    if (!link) return
    event.preventDefault()
    const href = link.getAttribute('href') ?? ''
    if (/^https?:/i.test(href)) useBrowser.getState().openUrl(href)
    else if (/^mailto:/i.test(href)) void window.crew.openExternal(href)
  }

  return <div className="md" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}
