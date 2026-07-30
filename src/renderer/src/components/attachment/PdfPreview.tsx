import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import Skeleton from '../Skeleton'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const PAPER = 11 / 8.5
const NEAR = '800px'
const DENSITY = 2

export default function PdfPreview({ url, name }: { url: string; name: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  const [width, setWidth] = useState(0)
  const [aspect, setAspect] = useState(PAPER)
  const column = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = column.current
    if (!el) return
    const read = (): void => setWidth(old => (old === el.clientWidth ? old : el.clientWidth))
    read()
    const watch = new ResizeObserver(read)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  useEffect(() => {
    let alive = true
    let task: PDFDocumentLoadingTask | null = null
    setDoc(null)
    setFailed(false)
    setAspect(PAPER)
    void (async () => {
      try {
        const answer = await fetch(url)
        if (!answer.ok) throw new Error(String(answer.status))
        const data = new Uint8Array(await answer.arrayBuffer())
        if (!alive) return
        task = pdfjs.getDocument({ data })
        const opened = await task.promise
        if (!alive) return
        setDoc(opened)
      } catch (why) {
        console.log('PDFWHY ' + (why && why.message ? why.message : why))
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
      void task?.destroy()
    }
  }, [url])

  return (
    <div data-pdf aria-label={name} className="absolute inset-0 overflow-y-auto overflow-x-hidden bg-ink-900 p-3">
      <div ref={column} className="flex flex-col items-center gap-4">
        {!failed &&
          Array.from({ length: doc?.numPages ?? 1 }, (_, i) => (
            <Paper
              key={i + 1}
              doc={doc}
              number={i + 1}
              width={width}
              aspect={aspect}
              onAspect={i === 0 ? setAspect : undefined}
            />
          ))}
      </div>
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <p className="text-sm text-fg-muted">Could not open this file</p>
        </div>
      )}
    </div>
  )
}

function Paper({
  doc,
  number,
  width,
  aspect,
  onAspect
}: {
  doc: PDFDocumentProxy | null
  number: number
  width: number
  aspect: number
  onAspect?: (aspect: number) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const flow = useRef<Promise<unknown>>(Promise.resolve())
  const [own, setOwn] = useState(0)
  const [painted, setPainted] = useState(false)
  const near = useNear(box)
  const tall = Math.round(width * (own || aspect))

  useEffect(() => {
    if (!doc || !near || !width) return
    let alive = true
    let render: RenderTask | null = null
    const paint = async (): Promise<void> => {
      const page = await doc.getPage(number)
      if (!alive) return
      const unit = page.getViewport({ scale: 1 })
      setOwn(unit.height / unit.width)
      onAspect?.(unit.height / unit.width)
      const density = Math.min(window.devicePixelRatio || 1, DENSITY)
      const viewport = page.getViewport({ scale: (width / unit.width) * density })
      const el = canvas.current
      if (!el) return
      el.width = Math.round(viewport.width)
      el.height = Math.round(viewport.height)
      render = page.render({ canvas: el, viewport })
      await render.promise
      if (alive) setPainted(true)
    }
    flow.current = flow.current.then(paint, paint).catch(() => {})
    return () => {
      alive = false
      render?.cancel()
    }
  }, [doc, number, width, near, onAspect])

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div ref={box} className="relative" style={{ width, height: tall }}>
        <canvas ref={canvas} className="block" style={{ width, height: tall }} />
        {!painted && (
          <div className="absolute inset-0">
            <Skeleton />
          </div>
        )}
      </div>
      <span className="text-xs text-fg-faint">{number}</span>
    </div>
  )
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
      { rootMargin: NEAR }
    )
    watch.observe(el)
    return () => watch.disconnect()
  }, [ref, near])
  return near
}
