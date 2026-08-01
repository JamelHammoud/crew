import './text.css'

export interface TextMeasureOptions {
  fontStyle: string
  fontWeight: string
  fontFamily: string
  fontSize: number
  lineHeight: number
  maxWidth: number | null
  minWidth?: number | null
  padding: string
  otherStyles?: Record<string, string>
  disableOverflowWrapBreaking?: boolean
  measureScrollWidth?: boolean
}

export interface MeasuredTextSize {
  x: number
  y: number
  w: number
  h: number
  scrollWidth: number
}

export interface TextMeasurementRequest {
  html: string
  options: TextMeasureOptions
}

export type TextSpanAlign = 'start' | 'start-legacy' | 'middle' | 'middle-legacy' | 'end' | 'end-legacy'

export interface TextSpanMeasureOptions {
  overflow: 'wrap' | 'truncate-ellipsis' | 'truncate-clip'
  width: number
  height: number
  padding: number
  fontSize: number
  fontWeight: string
  fontFamily: string
  fontStyle: string
  lineHeight: number
  textAlign: TextSpanAlign
  otherStyles?: Record<string, string>
  measureScrollWidth?: boolean
}

export interface MeasuredTextBox {
  x: number
  y: number
  w: number
  h: number
}

export interface MeasuredTextSpan {
  text: string
  box: MeasuredTextBox
}

interface PoolItem {
  element: HTMLDivElement
  html: string
  styleKeys: string[]
}

const DEFAULT_STYLES: Record<string, string | null> = {
  'overflow-wrap': 'break-word',
  'word-break': 'auto',
  width: null,
  height: null,
  'max-width': null,
  'min-width': null
}

const NEW_LINES = /\r?\n|\r/g

export function resolveLineHeight(fontSize: number, lineHeight: number): number {
  return Math.round(fontSize * lineHeight)
}

export function normalizeTextForMeasurement(text: string): string {
  return text
    .replace(NEW_LINES, '\n')
    .split('\n')
    .map(line => line || ' ')
    .join('\n')
}

export class TextMeasurement {
  private readonly element: HTMLDivElement
  private readonly pool: PoolItem[] = []

  constructor(
    private readonly document: Document,
    private readonly container: HTMLElement
  ) {
    this.element = this.createElement()
    container.appendChild(this.element)
  }

  dispose(): void {
    this.element.remove()
    for (const item of this.pool) item.element.remove()
    this.pool.length = 0
  }

  measureText(text: string, options: TextMeasureOptions): MeasuredTextSize {
    const div = this.document.createElement('div')
    div.textContent = normalizeTextForMeasurement(text)
    return this.measureHtml(div.innerHTML, options)
  }

  measureHtml(html: string, options: TextMeasureOptions): MeasuredTextSize {
    const restore = this.applyStyles(this.element, this.stylesFor(options))
    try {
      this.element.innerHTML = html
      return this.read(this.element, options.measureScrollWidth === true)
    } finally {
      restore()
    }
  }

  measureHtmlBatch(requests: TextMeasurementRequest[]): MeasuredTextSize[] {
    if (requests.length === 0) return []
    while (this.pool.length > requests.length) this.pool.pop()?.element.remove()
    this.ensurePool(requests.length)
    for (let index = 0; index < requests.length; index++) {
      const request = requests[index]
      const item = this.pool[index]
      this.resetStyles(item.element, item.styleKeys)
      const styles = this.stylesFor(request.options)
      this.applyStyles(item.element, styles)
      item.styleKeys = Object.keys(styles)
      if (item.html !== request.html) {
        item.element.innerHTML = request.html
        item.html = request.html
      }
    }
    return requests.map((request, index) =>
      this.read(this.pool[index].element, request.options.measureScrollWidth === true)
    )
  }

  private createElement(): HTMLDivElement {
    const element = this.document.createElement('div')
    element.classList.add('crew-text', 'crew-text-measure')
    element.dir = 'auto'
    element.tabIndex = -1
    element.setAttribute('aria-hidden', 'true')
    for (const [key, value] of Object.entries(DEFAULT_STYLES)) {
      if (value !== null) element.style.setProperty(key, value)
    }
    return element
  }

  private ensurePool(size: number): void {
    const fragment = this.document.createDocumentFragment()
    while (this.pool.length < size) {
      const element = this.createElement()
      this.pool.push({ element, html: '', styleKeys: [] })
      fragment.appendChild(element)
    }
    this.container.appendChild(fragment)
  }

  private stylesFor(options: TextMeasureOptions): Record<string, string | undefined> {
    return {
      'font-family': options.fontFamily,
      'font-style': options.fontStyle,
      'font-weight': options.fontWeight,
      'font-size': `${options.fontSize}px`,
      'line-height': `${resolveLineHeight(options.fontSize, options.lineHeight)}px`,
      padding: options.padding,
      'max-width': options.maxWidth === null ? undefined : `${options.maxWidth}px`,
      'min-width': options.minWidth == null ? undefined : `${options.minWidth}px`,
      'overflow-wrap': options.disableOverflowWrapBreaking ? 'normal' : 'break-word',
      ...options.otherStyles
    }
  }

  private applyStyles(element: HTMLElement, styles: Record<string, string | undefined>): () => void {
    const restore: Array<[string, string | null]> = []
    for (const [key, value] of Object.entries(styles)) {
      const before = element.style.getPropertyValue(key) || null
      if (value === undefined) {
        if (before === null) continue
        restore.push([key, before])
        element.style.removeProperty(key)
      } else if (before !== value) {
        restore.push([key, before])
        element.style.setProperty(key, value)
      }
    }
    return () => {
      for (const [key, value] of restore) {
        if (value === null) element.style.removeProperty(key)
        else element.style.setProperty(key, value)
      }
    }
  }

  private resetStyles(element: HTMLElement, keys: string[]): void {
    for (const key of keys) {
      const value = DEFAULT_STYLES[key]
      if (value === undefined || value === null) element.style.removeProperty(key)
      else element.style.setProperty(key, value)
    }
  }

  private read(element: HTMLElement, scroll: boolean): MeasuredTextSize {
    const bounds = element.getBoundingClientRect()
    return { x: 0, y: 0, w: bounds.width, h: bounds.height, scrollWidth: scroll ? element.scrollWidth : 0 }
  }
}
