import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject
} from 'react'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import FindBar from '../FindBar'
import Skeleton from '../Skeleton'
import ZoomView from '../ZoomView'
import { Failed } from './Frame'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const PAPER = 11 / 8.5
const NEAR = '800px'
const SETTLED = 150
const MAX_PIXELS = 8_388_608

const TEXT_CSS = `
.pdf-text {
  position: absolute;
  inset: 0;
  text-align: initial;
  overflow: clip;
  line-height: 1;
  letter-spacing: normal;
  word-spacing: normal;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  z-index: 0;
  --scale-round-x: 1px;
  --scale-round-y: 1px;
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}
.pdf-text :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
}
.pdf-text > :not(.markedContent),
.pdf-text .markedContent span:not(.markedContent) {
  z-index: 1;
  --font-height: 0;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  --scale-x: 1;
  --rotate: 0deg;
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}
.pdf-text .markedContent {
  display: contents;
}
.pdf-text .endOfContent {
  display: block;
  position: absolute;
  inset: 100% 0 0;
  z-index: 0;
  cursor: default;
  user-select: none;
}
[data-pan] .pdf-text :is(span, br) {
  cursor: inherit;
}
.pdf-text span::selection {
  background: var(--color-selection);
  color: transparent;
}
.pdf-text span::highlight(find-match) {
  background-color: rgb(250 204 21 / 0.35);
  color: transparent;
}
.pdf-text span::highlight(find-match-active) {
  background-color: rgb(251 191 36 / 0.5);
  color: transparent;
}
.pdf-page {
  user-select: none;
}
.pdf-page::after {
  content: attr(data-page);
}
`

export default function PdfPreview({ url, name }: { url: string; name: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  const [width, setWidth] = useState(0)
  const [shape, setShape] = useState({ aspect: PAPER, natural: 0 })
  const scroller = useRef<HTMLDivElement>(null)
  const column = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = column.current
    if (!el) return
    const read = (): void => setWidth(old => (old === el.clientWidth ? old : el.clientWidth))
    read()
    const watch = new ResizeObserver(read)
    watch.observe(el)
    return () => watch.disconnect()
  }, [failed])

  useEffect(() => {
    let alive = true
    let task: PDFDocumentLoadingTask | null = null
    setDoc(null)
    setFailed(false)
    setShape({ aspect: PAPER, natural: 0 })
    void (async () => {
      try {
        const answer = await fetch(url)
        if (!answer.ok) throw new Error(String(answer.status))
        const data = new Uint8Array(await answer.arrayBuffer())
        if (!alive) return
        task = pdfjs.getDocument({ data, ...pdfAssets() })
        const opened = await task.promise
        if (!alive) return
        setDoc(opened)
      } catch {
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
      void task?.destroy()
    }
  }, [url])

  const measured = useCallback((aspect: number, natural: number) => {
    setShape(old => (old.aspect === aspect && old.natural === natural ? old : { aspect, natural }))
  }, [])

  const content = useCallback(
    () =>
      width
        ? { box: { width, height: Math.round(width * shape.aspect) }, natural: shape.natural }
        : null,
    [width, shape]
  )

  if (failed) return <Failed label="Could not read this file" />

  return (
    <div className="absolute inset-0">
      <style>{TEXT_CSS}</style>
      <FindBar containerRef={column} scrollerRef={scroller} placeholder="Find in this file" />
      <ZoomView content={content} refit={url} className="w-full h-full">
        {({ scale }) => (
          <Pages
            doc={doc}
            zoom={scale}
            width={width}
            aspect={shape.aspect}
            label={name}
            scrollerRef={scroller}
            columnRef={column}
            onMeasured={measured}
          />
        )}
      </ZoomView>
    </div>
  )
}

function Pages({
  doc,
  zoom,
  width,
  aspect,
  label,
  scrollerRef,
  columnRef,
  onMeasured
}: {
  doc: PDFDocumentProxy | null
  zoom: number
  width: number
  aspect: number
  label: string
  scrollerRef: RefObject<HTMLDivElement>
  columnRef: RefObject<HTMLDivElement>
  onMeasured: (aspect: number, natural: number) => void
}) {
  const density = useDensity(zoom)
  const panning = zoom > 1

  return (
    <div
      ref={scrollerRef}
      data-pdf
      data-pan={panning ? '' : undefined}
      aria-label={label}
      onWheelCapture={event => {
        if (!event.ctrlKey) event.stopPropagation()
      }}
      className={`w-full h-full overflow-y-auto overflow-x-hidden p-3 ${
        panning ? 'select-none' : 'select-text'
      }`}
    >
      <div ref={columnRef} className="flex flex-col items-center gap-4">
        {Array.from({ length: doc?.numPages ?? 1 }, (_, i) => (
          <Paper
            key={i + 1}
            doc={doc}
            number={i + 1}
            width={width}
            aspect={aspect}
            density={density}
            onMeasured={i === 0 ? onMeasured : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function Paper({
  doc,
  number,
  width,
  aspect,
  density,
  onMeasured
}: {
  doc: PDFDocumentProxy | null
  number: number
  width: number
  aspect: number
  density: number
  onMeasured?: (aspect: number, natural: number) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const flow = useRef<Promise<unknown>>(Promise.resolve())
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const [painted, setPainted] = useState(false)
  const near = useNear(box)
  const unit = useMemo(() => page?.getViewport({ scale: 1 }) ?? null, [page])
  const tall = Math.round(width * (unit ? unit.height / unit.width : aspect))

  useEffect(() => {
    if (!doc) return
    let alive = true
    void doc
      .getPage(number)
      .then(got => {
        if (alive) setPage(got)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [doc, number])

  useEffect(() => {
    if (!unit || !onMeasured) return
    onMeasured(unit.height / unit.width, unit.width * pdfjs.PixelsPerInch.PDF_TO_CSS_UNITS)
  }, [unit, onMeasured])

  useEffect(() => {
    if (!page || !unit || !near || !width || !tall) return
    let alive = true
    let render: RenderTask | null = null
    const paint = async (): Promise<void> => {
      const room = Math.sqrt(MAX_PIXELS / (width * tall))
      const viewport = page.getViewport({ scale: (width / unit.width) * Math.min(density, room) })
      const fresh = document.createElement('canvas')
      fresh.width = Math.round(viewport.width)
      fresh.height = Math.round(viewport.height)
      render = page.render({ canvas: fresh, viewport })
      await render.promise
      const shown = canvas.current
      if (!alive || !shown) return
      shown.width = fresh.width
      shown.height = fresh.height
      shown.getContext('2d')?.drawImage(fresh, 0, 0)
      setPainted(true)
    }
    flow.current = flow.current.then(paint, paint).catch(() => {})
    return () => {
      alive = false
      render?.cancel()
    }
  }, [page, unit, near, width, tall, density])

  useEffect(() => {
    const container = text.current
    if (!page || !container) return
    let alive = true
    let layer: InstanceType<typeof pdfjs.TextLayer> | null = null
    void (async () => {
      const words = await page.getTextContent()
      if (!alive) return
      layer = new pdfjs.TextLayer({
        textContentSource: words,
        container,
        viewport: page.getViewport({ scale: 1 })
      })
      await layer.render()
    })().catch(() => {})
    return () => {
      alive = false
      layer?.cancel()
      container.replaceChildren()
    }
  }, [page])

  useEffect(() => {
    const container = text.current
    if (!container || !unit || !width) return
    container.style.setProperty('--total-scale-factor', String(width / unit.width))
  }, [unit, width])

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div ref={box} className="relative" style={{ width, height: tall }}>
        <canvas ref={canvas} className="block w-full h-full" />
        <div ref={text} data-pdf-text className="pdf-text" />
        {!painted && (
          <div className="absolute inset-0">
            <Skeleton />
          </div>
        )}
      </div>
      <span data-page={number} className="pdf-page text-xs text-fg-faint" />
    </div>
  )
}

function useDensity(zoom: number): number {
  const [settled, setSettled] = useState(1)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(zoom), SETTLED)
    return () => window.clearTimeout(timer)
  }, [zoom])
  return Math.min(window.devicePixelRatio || 1, 2) * settled
}

function useNear(ref: RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const watch = new IntersectionObserver(
      marks => {
        if (marks.some(mark => mark.isIntersecting)) setNear(true)
      },
      { root: el.closest('[data-pdf]'), rootMargin: NEAR }
    )
    watch.observe(el)
    return () => watch.disconnect()
  }, [ref, near])
  return near
}
