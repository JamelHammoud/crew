import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import FindBar from '../FindBar'
import Skeleton from '../Skeleton'
import Tooltip from '../Tooltip'
import { pinchFactor } from '../zoom'
import { Failed } from './Frame'
import { pdfAssets } from './pdfAssets'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const PAPER = 11 / 8.5
const NEAR = '800px'
const SETTLED = 150
const MAX_PIXELS = 8_388_608
const PAD = 12
const MIN_ZOOM = 1
const MAX_ZOOM = 8

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
.pdf-text span::selection {
  background: var(--color-selection-paper);
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
`

const hold = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

type Anchor = { fx: number; fy: number; x: number; y: number }

export default function PdfPreview({ url, name }: { url: string; name: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  const [frame, setFrame] = useState(0)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [shape, setShape] = useState({ aspect: PAPER, natural: 0 })
  const scroller = useRef<HTMLDivElement>(null)
  const column = useRef<HTMLDivElement>(null)
  const anchor = useRef<Anchor | null>(null)

  const width = Math.round(Math.max(0, frame - PAD * 2) * zoom)
  const paint = useSettled(width)

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const read = (): void => setFrame(old => (old === el.clientWidth ? old : el.clientWidth))
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
    setZoom(MIN_ZOOM)
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

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const box = column.current?.getBoundingClientRect()
      anchor.current =
        box && box.width > 0 && box.height > 0
          ? {
              fx: (event.clientX - box.left) / box.width,
              fy: (event.clientY - box.top) / box.height,
              x: event.clientX,
              y: event.clientY
            }
          : null
      setZoom(old => hold(old * pinchFactor(event.deltaY)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useLayoutEffect(() => {
    const want = anchor.current
    anchor.current = null
    const el = scroller.current
    const box = column.current?.getBoundingClientRect()
    if (!want || !el || !box) return
    el.scrollLeft += box.left + want.fx * box.width - want.x
    el.scrollTop += box.top + want.fy * box.height - want.y
  }, [width])

  const measured = useCallback((aspect: number, natural: number) => {
    setShape(old => (old.aspect === aspect && old.natural === natural ? old : { aspect, natural }))
  }, [])

  if (failed) return <Failed label="Could not read this file" />

  const percent = shape.natural ? Math.round((width / shape.natural) * 100) : 0

  return (
    <div className="absolute inset-0">
      <style>{TEXT_CSS}</style>
      <FindBar containerRef={column} scrollerRef={scroller} placeholder="Find in this file" className="top-4 right-4" />
      <div ref={scroller} data-pdf aria-label={name} className="absolute inset-0 overflow-auto select-text">
        <div ref={column} className="w-max min-w-full flex flex-col items-center gap-4 p-3">
          {Array.from({ length: doc?.numPages ?? 1 }, (_, i) => (
            <Paper
              key={i + 1}
              doc={doc}
              number={i + 1}
              width={width}
              paint={paint}
              aspect={shape.aspect}
              onMeasured={i === 0 ? measured : undefined}
            />
          ))}
        </div>
      </div>
      {zoom > MIN_ZOOM && percent > 0 && (
        <Tooltip label="Fit to width" className="absolute bottom-4 right-4">
          <button
            onClick={() => setZoom(MIN_ZOOM)}
            className="glass animate-pop h-8 px-3 rounded-full text-xs tabular-nums text-fg/70 transition-all duration-150 hover:text-fg active:scale-95"
          >
            {percent}%
          </button>
        </Tooltip>
      )}
    </div>
  )
}

function Paper({
  doc,
  number,
  width,
  paint,
  aspect,
  onMeasured
}: {
  doc: PDFDocumentProxy | null
  number: number
  width: number
  paint: number
  aspect: number
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
  const ratio = unit ? unit.height / unit.width : aspect
  const tall = Math.round(width * ratio)

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
    if (!page || !unit || !paint) return
    if (!near) {
      const gone = canvas.current
      if (gone) {
        gone.width = 0
        gone.height = 0
      }
      setPainted(false)
      return
    }
    let alive = true
    let render: RenderTask | null = null
    const draw = async (): Promise<void> => {
      const room = Math.sqrt(MAX_PIXELS / (paint * paint * ratio))
      const density = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: (paint / unit.width) * Math.min(density, room) })
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
    flow.current = flow.current.then(draw, draw).catch(() => {})
    return () => {
      alive = false
      render?.cancel()
    }
  }, [page, unit, near, paint, ratio])

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
    <div ref={box} className="relative shrink-0" style={{ width, height: tall }}>
      <canvas ref={canvas} className="block w-full h-full" />
      <div ref={text} data-pdf-text className="pdf-text" />
      {!painted && (
        <div className="absolute inset-0">
          <Skeleton />
        </div>
      )}
    </div>
  )
}

function useSettled(value: number): number {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    if (!settled) {
      setSettled(value)
      return
    }
    const timer = window.setTimeout(() => setSettled(value), SETTLED)
    return () => window.clearTimeout(timer)
  }, [value, settled])
  return settled
}

function useNear(ref: RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const watch = new IntersectionObserver(marks => setNear(marks[marks.length - 1].isIntersecting), {
      root: el.closest('[data-pdf]'),
      rootMargin: NEAR
    })
    watch.observe(el)
    return () => watch.disconnect()
  }, [ref])
  return near
}
