import { useEffect, useMemo, useRef, useState } from 'react'
import { useBrowser } from '../../state/browser'
import { useMail, type MailAddress, type MailDraftInput } from '../../state/mail'
import { useTheme, type Theme } from '../../state/theme'

const EXTERNAL_LINK = /^(https?|mailto):/i

const decoded = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const mailAddresses = (values: string[]): MailAddress[] =>
  values
    .flatMap(value => value.split(','))
    .map(value => decoded(value).trim())
    .filter(Boolean)
    .map(value => {
      const named = value.match(/^\s*([^<]*)<([^>]+)>\s*$/)
      return named
        ? { name: named[1].trim().replace(/^['"]|['"]$/g, '') || undefined, email: named[2].trim() }
        : { email: value }
    })

export function draftFromMailto(href: string): Partial<MailDraftInput> {
  const link = new URL(href)
  if (link.protocol.toLowerCase() !== 'mailto:') return {}
  const headers = new Map<string, string[]>()
  link.searchParams.forEach((value, key) => {
    const name = key.toLowerCase()
    headers.set(name, [...(headers.get(name) ?? []), value])
  })
  return {
    to: mailAddresses([link.pathname, ...(headers.get('to') ?? [])]),
    cc: mailAddresses(headers.get('cc') ?? []),
    bcc: mailAddresses(headers.get('bcc') ?? []),
    subject: headers.get('subject')?.[0] ?? '',
    text: headers.get('body')?.[0] ?? ''
  }
}

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
    * { box-sizing: border-box; }
    body { margin: 0; color: rgba(${foreground},.82); font: 14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow-wrap: anywhere; }
    a { color: rgba(${foreground},.95); text-decoration: underline; text-underline-offset: 2px; }
    blockquote { margin-left: 0; padding-left: 14px; border-left: 2px solid rgba(${foreground},.12); color: rgba(${foreground},.55); }
    pre { white-space: pre-wrap; }
    img { max-width: 100vw; }
  `
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${style}</style></head>${parsed.body.outerHTML}</html>`
}

export default function HtmlMessage({ html, text, accountId }: { html?: string; text: string; accountId?: string }) {
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
    let scan = 0
    const loaded = (doc = iframe.contentDocument) => {
      if (!doc?.body) return
      window.clearInterval(scan)
      observer?.disconnect()
      if (loadedDocument && linkHandler) loadedDocument.removeEventListener('click', linkHandler)
      const size = () => setHeight(Math.max(24, doc.documentElement.scrollHeight, doc.body.scrollHeight))
      const links = (event: MouseEvent) => {
        const link = (event.target as Element | null)?.closest('a')
        const href = link?.getAttribute('href')
        if (!href || !EXTERNAL_LINK.test(href)) return
        event.preventDefault()
        event.stopPropagation()
        if (/^https?:/i.test(href)) {
          useBrowser.getState().openUrl(href)
          return
        }
        const account = accountId ?? useMail.getState().accounts[0]?.id
        if (account) useMail.getState().makeDraft(account, draftFromMailto(href))
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
    const ready = () => {
      const doc = iframe.contentDocument
      if (!doc?.body || doc.URL === 'about:blank') return
      loaded(doc)
    }
    const complete = () => loaded()
    iframe.addEventListener('load', complete)
    ready()
    scan = window.setInterval(ready, 16)
    return () => {
      iframe.removeEventListener('load', complete)
      window.clearInterval(scan)
      observer?.disconnect()
      if (loadedDocument && linkHandler) loadedDocument.removeEventListener('click', linkHandler)
    }
  }, [accountId, document])

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
