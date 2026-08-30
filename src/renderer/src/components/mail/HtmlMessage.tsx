import { useEffect, useMemo, useRef, useState } from 'react'
import { useBrowser } from '../../state/browser'
import { useMail, type MailAddress, type MailDraftInput } from '../../state/mail'
import { useTheme, type Theme } from '../../state/theme'

const EXTERNAL_LINK = /^(https?|mailto):/i
const LIGHT_FOREGROUND = [20, 20, 20] as const
const DARK_FOREGROUND = [255, 255, 255] as const

type Rgb = readonly [number, number, number]

function cssRgb(value: string): { rgb: Rgb; alpha: number } | undefined {
  if (value === 'white') return { rgb: DARK_FOREGROUND, alpha: 1 }
  if (value === 'black') return { rgb: [0, 0, 0], alpha: 1 }
  const match = value.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i)
  if (!match) return undefined
  const alpha = match[4]?.endsWith('%') ? Number.parseFloat(match[4]) / 100 : Number.parseFloat(match[4] ?? '1')
  return {
    rgb: [Number.parseFloat(match[1]), Number.parseFloat(match[2]), Number.parseFloat(match[3])],
    alpha
  }
}

function luminance(rgb: Rgb): number {
  const channels = rgb.map(channel => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(first: Rgb, second: Rgb): number {
  const brightest = Math.max(luminance(first), luminance(second))
  const darkest = Math.min(luminance(first), luminance(second))
  return (brightest + 0.05) / (darkest + 0.05)
}

function foregroundFor(background: string, theme: Theme): Rgb {
  const themeBackground = theme === 'light' ? DARK_FOREGROUND : LIGHT_FOREGROUND
  const parsed = cssRgb(background)
  if (!parsed || parsed.alpha <= 0) return theme === 'light' ? LIGHT_FOREGROUND : DARK_FOREGROUND
  const canvas = parsed.rgb.map((channel, index) => channel * parsed.alpha + themeBackground[index] * (1 - parsed.alpha)) as unknown as Rgb
  const dark = LIGHT_FOREGROUND.map((channel, index) => channel * 0.82 + canvas[index] * 0.18) as unknown as Rgb
  const light = DARK_FOREGROUND.map((channel, index) => channel * 0.82 + canvas[index] * 0.18) as unknown as Rgb
  return contrast(dark, canvas) >= contrast(light, canvas) ? LIGHT_FOREGROUND : DARK_FOREGROUND
}

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
  let link: URL
  try {
    link = new URL(href)
  } catch {
    return {}
  }
  if (link.protocol.toLowerCase() !== 'mailto:') return {}
  const headers = new Map<string, string[]>()
  link.searchParams.forEach((value, key) => {
    const name = key.toLowerCase()
    headers.set(name, [...(headers.get(name) ?? []), value])
  })
  const subject = headers.get('subject')?.[0]
  const body = headers.get('body')?.[0]
  return {
    to: mailAddresses([link.pathname, ...(headers.get('to') ?? [])]),
    cc: mailAddresses(headers.get('cc') ?? []),
    bcc: mailAddresses(headers.get('bcc') ?? []),
    ...(subject === undefined ? {} : { subject }),
    ...(body === undefined ? {} : { text: body })
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
  const color = parsed.createElement('span')
  color.style.backgroundColor = parsed.body.getAttribute('bgcolor') ?? ''
  const background = parsed.body.style.backgroundColor || color.style.backgroundColor || 'transparent'
  const foreground = foregroundFor(background, theme).join(',')
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
