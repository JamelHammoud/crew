import { useEffect, useMemo, useRef, useState } from 'react'
import { useBrowser } from '../../state/browser'
import { useTheme, type Theme } from '../../state/theme'

const EXTERNAL_LINK = /^(https?|mailto):/i

export function safeMailDocument(html: string, theme: Theme): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  parsed.querySelectorAll('script, iframe, object, embed, form, input, button, meta, base, link').forEach(node => node.remove())
  parsed.querySelectorAll('*').forEach(node => {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || name === 'srcdoc') node.removeAttribute(attribute.name)
      if ((name === 'href' || name === 'action') && !EXTERNAL_LINK.test(attribute.value)) {
        node.removeAttribute(attribute.name)
      }
    }
  })
  const csp = `default-src 'none'; img-src data: blob: crew-mail: http: https:; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; connect-src 'none'; frame-src 'none'`
  const light = theme === 'light'
  const foreground = light ? '20,20,20' : '255,255,255'
  const color = parsed.createElement('span')
  color.style.backgroundColor = parsed.body.getAttribute('bgcolor') ?? ''
  const background = parsed.body.style.backgroundColor || color.style.backgroundColor || 'transparent'
  const style = `
    :root { background: ${background}; }
    * { box-sizing: border-box; max-width: 100%; }
    body { margin: 0; color: rgba(${foreground},.82); font: 14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow-wrap: anywhere; }
    a { color: rgba(${foreground},.95); text-decoration: underline; text-underline-offset: 2px; }
    blockquote { margin-left: 0; padding-left: 14px; border-left: 2px solid rgba(${foreground},.12); color: rgba(${foreground},.55); }
    pre { white-space: pre-wrap; }
    img { height: auto; }
    table { border-collapse: collapse; }
  `
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${style}</style></head>${parsed.body.outerHTML}</html>`
}

export default function HtmlMessage({ html, text }: { html?: string; text: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(80)
  const theme = useTheme()
  const document = useMemo(() => {
    const plain = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>')
    return safeMailDocument(html ?? plain, theme)
  }, [html, text, theme])

  useEffect(() => {
    const iframe = frame.current
    if (!iframe) return
    let observer: ResizeObserver | undefined
    let loadedDocument: Document | undefined
    let linkHandler: ((event: MouseEvent) => void) | undefined
    const loaded = () => {
      const doc = iframe.contentDocument
      if (!doc) return
      observer?.disconnect()
      if (loadedDocument && linkHandler) loadedDocument.removeEventListener('click', linkHandler)
      const size = () => setHeight(Math.max(24, doc.documentElement.scrollHeight, doc.body.scrollHeight))
      const links = (event: MouseEvent) => {
        const link = (event.target as Element | null)?.closest('a')
        const href = link?.getAttribute('href')
        if (!href || !EXTERNAL_LINK.test(href)) return
        event.preventDefault()
        event.stopPropagation()
        if (/^https?:/i.test(href)) useBrowser.getState().openUrl(href)
        else void window.crew.openExternal(href)
      }
      loadedDocument = doc
      linkHandler = links
      doc.addEventListener('click', links)
      size()
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(size)
        observer.observe(doc.body)
      }
    }
    iframe.addEventListener('load', loaded)
    return () => {
      iframe.removeEventListener('load', loaded)
      observer?.disconnect()
      if (loadedDocument && linkHandler) loadedDocument.removeEventListener('click', linkHandler)
    }
  }, [document])

  return (
    <div className="overflow-hidden rounded-xl">
      <iframe
        ref={frame}
        title="Message"
        sandbox="allow-same-origin"
        srcDoc={document}
        scrolling="no"
        className="block w-full border-0 bg-transparent"
        style={{ height }}
      />
    </div>
  )
}
