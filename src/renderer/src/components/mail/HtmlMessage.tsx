import { useEffect, useMemo, useRef, useState } from 'react'
import { EyeGlyph, EyeOffGlyph } from '../../icons'

const REMOTE_IMAGE = /^https?:/i
const EXTERNAL_LINK = /^(https?|mailto):/i

function safeDocument(html: string, images: boolean): { html: string; blocked: number } {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  let blocked = 0
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
  parsed.querySelectorAll('img').forEach(image => {
    const src = image.getAttribute('src') ?? ''
    if (REMOTE_IMAGE.test(src) && !images) {
      blocked += 1
      image.dataset.remoteSrc = src
      image.removeAttribute('src')
      image.removeAttribute('srcset')
      image.alt = image.alt || 'Remote image'
      image.style.display = 'none'
    }
  })
  const imageSource = images ? 'data: blob: http: https:' : 'data: blob:'
  const csp = `default-src 'none'; img-src ${imageSource}; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; connect-src 'none'; frame-src 'none'`
  const style = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; max-width: 100%; }
    body { margin: 0; color: rgba(255,255,255,.82); background: transparent; font: 14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow-wrap: anywhere; }
    a { color: rgba(255,255,255,.95); text-decoration: underline; text-underline-offset: 2px; }
    blockquote { margin-left: 0; padding-left: 14px; border-left: 2px solid rgba(255,255,255,.12); color: rgba(255,255,255,.55); }
    pre { white-space: pre-wrap; }
    img { height: auto; }
    table { border-collapse: collapse; }
  `
  return {
    blocked,
    html: `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${style}</style></head><body>${parsed.body.innerHTML}</body></html>`
  }
}

export default function HtmlMessage({ html, text }: { html?: string; text: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [images, setImages] = useState(false)
  const [height, setHeight] = useState(80)
  const document = useMemo(() => safeDocument(html ?? text.replace(/\n/g, '<br>'), images), [html, text, images])

  useEffect(() => {
    const iframe = frame.current
    if (!iframe) return
    let observer: ResizeObserver | undefined
    const loaded = () => {
      const doc = iframe.contentDocument
      if (!doc) return
      const size = () => setHeight(Math.max(24, doc.documentElement.scrollHeight, doc.body.scrollHeight))
      const links = (event: MouseEvent) => {
        const link = (event.target as Element | null)?.closest('a')
        const href = link?.getAttribute('href')
        if (!href || !EXTERNAL_LINK.test(href)) return
        event.preventDefault()
        event.stopPropagation()
        void window.crew.openExternal(href)
      }
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
    }
  }, [document.html])

  return (
    <div>
      {document.blocked > 0 && (
        <button
          type="button"
          onClick={() => setImages(value => !value)}
          className="mb-4 h-8 px-3 rounded-full bg-fg/[0.06] flex items-center gap-2 text-xs font-medium text-fg/55 transition-colors hover:bg-fg/[0.1] hover:text-fg active:scale-95"
        >
          {images ? <EyeOffGlyph className="w-4 h-4" /> : <EyeGlyph className="w-4 h-4" />}
          {images ? 'Hide images' : `Show ${document.blocked === 1 ? 'image' : `${document.blocked} images`}`}
        </button>
      )}
      <iframe
        ref={frame}
        title="Message"
        sandbox="allow-same-origin"
        srcDoc={document.html}
        scrolling="no"
        className="block w-full border-0 bg-transparent"
        style={{ height }}
      />
    </div>
  )
}
