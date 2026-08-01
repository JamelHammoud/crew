import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Editor } from './editor'
import { EditorContext } from './react'
import { Canvas, type CanvasShapeRenderer } from './render'
import type { TLRecord, TLShape } from './schema'
import type { ShapeUtilConstructor } from './shapes'
import type { Store } from './store'
import { EditingLayer } from './text/EditingLayer'
import {
  ArrowShapeTool,
  DrawShapeTool,
  EraserTool,
  FrameShapeTool,
  HandTool,
  HighlightShapeTool,
  LineShapeTool,
  NoteShapeTool,
  SelectTool,
  TextShapeTool
} from './tools'

const BUILT_IN_TOOLS = [
  SelectTool,
  HandTool,
  DrawShapeTool,
  HighlightShapeTool,
  EraserTool,
  TextShapeTool,
  NoteShapeTool,
  FrameShapeTool,
  LineShapeTool,
  ArrowShapeTool
] as const

export interface CrewCanvasOptions {
  camera?: { zoomMin?: number; zoomMax?: number; zoomSteps?: number[] | null }
  [key: string]: unknown
}

const handled = new WeakSet<Event>()

function taken(event: Event): boolean {
  return handled.has(event)
}

function take(event: Event): void {
  handled.add(event)
}

function capturesKeys(element: Element | null): boolean {
  if (!element) return false
  const tag = element.tagName.toLowerCase()
  return (
    (element as HTMLElement).isContentEditable ||
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    tag === 'button'
  )
}

export interface CrewCanvasProps {
  store: Store<TLRecord>
  shapeUtils: readonly ShapeUtilConstructor[]
  bindingUtils?: readonly unknown[]
  tools?: readonly unknown[]
  overlayUtils?: readonly unknown[]
  options?: Partial<CrewCanvasOptions>
  onMount?(editor: Editor): undefined | (() => void)
  children?: ReactNode
}

export function CrewCanvas({
  store,
  shapeUtils,
  bindingUtils = [],
  tools = [],
  overlayUtils = [],
  options,
  onMount,
  children
}: CrewCanvasProps) {
  const container = useRef<HTMLDivElement>(null)
  const built = useRef<Pick<
    CrewCanvasProps,
    'store' | 'shapeUtils' | 'bindingUtils' | 'tools' | 'overlayUtils' | 'options'
  > | null>(null)
  if (!built.current) built.current = { store, shapeUtils, bindingUtils, tools, overlayUtils, options }
  const [editor, setEditor] = useState<Editor | null>(null)

  useLayoutEffect(() => {
    const from = built.current
    if (!from) return
    const made = new Editor({
      store: from.store,
      shapeUtils: from.shapeUtils,
      bindingUtils: from.bindingUtils ?? [],
      tools: [...BUILT_IN_TOOLS, ...(from.tools ?? [])],
      overlayUtils: from.overlayUtils ?? [],
      options: from.options,
      getContainer: () => container.current ?? document.body
    })
    setEditor(made)
    return () => made.dispose()
  }, [])

  const renderer = useMemo<CanvasShapeRenderer<TLShape> | null>(
    () =>
      editor
        ? {
            render: shape => editor.getShapeUtil(shape).component(shape as never),
            isFilled: shape => editor.getShapeGeometry(shape).isFilled
          }
        : null,
    [editor]
  )

  useEffect(() => {
    const element = container.current
    if (!element || !editor) return
    const ownerDocument = element.ownerDocument
    const handlers = editor.getCanvasEventHandlers()
    let lastX = NaN
    let lastY = NaN
    const pointerDown = (event: PointerEvent) => {
      if (taken(event)) return
      take(event)
      element.focus({ preventScroll: true })
      handlers.onPointerDown(event)
    }
    const pointerMove = (event: PointerEvent) => {
      if (taken(event)) return
      take(event)
      if (event.clientX === lastX && event.clientY === lastY) return
      lastX = event.clientX
      lastY = event.clientY
      handlers.onPointerMove(event)
    }
    const keyDown = (event: KeyboardEvent) => {
      if (taken(event) || capturesKeys(ownerDocument.activeElement)) return
      take(event)
      handlers.onKeyDown(event)
    }
    const keyUp = (event: KeyboardEvent) => {
      if (taken(event) || capturesKeys(ownerDocument.activeElement)) return
      take(event)
      handlers.onKeyUp(event)
    }
    const pointerUp = (event: PointerEvent) => {
      if (taken(event)) return
      take(event)
      flushSync(() => handlers.onPointerUp(event))
    }
    const contextMenu = (event: MouseEvent) => {
      event.preventDefault()
      handlers.onContextMenu(event)
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      handlers.onWheel(event)
    }
    element.addEventListener('pointerdown', pointerDown)
    ownerDocument.addEventListener('pointermove', pointerMove)
    element.addEventListener('pointerup', pointerUp)
    element.addEventListener('pointercancel', handlers.onPointerCancel)
    element.addEventListener('dblclick', handlers.onDoubleClick)
    element.addEventListener('contextmenu', contextMenu)
    element.addEventListener('wheel', wheel, { passive: false })
    ownerDocument.addEventListener('keydown', keyDown)
    ownerDocument.addEventListener('keyup', keyUp)
    element.addEventListener('touchstart', handlers.onTouchStart, { passive: false })
    element.addEventListener('touchmove', handlers.onTouchMove, { passive: false })
    element.addEventListener('touchend', handlers.onTouchEnd)
    element.addEventListener('touchcancel', handlers.onTouchCancel)

    const size = () => {
      const bounds = element.getBoundingClientRect()
      editor.setViewportScreenBounds({ x: 0, y: 0, w: bounds.width, h: bounds.height })
    }
    const observer = new ResizeObserver(size)
    observer.observe(element)
    size()
    const stopMount = onMount?.(editor)
    return () => {
      observer.disconnect()
      element.removeEventListener('pointerdown', pointerDown)
      ownerDocument.removeEventListener('pointermove', pointerMove)
      element.removeEventListener('pointerup', pointerUp)
      element.removeEventListener('pointercancel', handlers.onPointerCancel)
      element.removeEventListener('dblclick', handlers.onDoubleClick)
      element.removeEventListener('contextmenu', contextMenu)
      element.removeEventListener('wheel', wheel)
      element.removeEventListener('keydown', handlers.onKeyDown)
      element.removeEventListener('keyup', handlers.onKeyUp)
      element.removeEventListener('touchstart', handlers.onTouchStart)
      element.removeEventListener('touchmove', handlers.onTouchMove)
      element.removeEventListener('touchend', handlers.onTouchEnd)
      element.removeEventListener('touchcancel', handlers.onTouchCancel)
      stopMount?.()
    }
  }, [editor, onMount])

  if (!editor || !renderer) return null

  return (
    <EditorContext.Provider value={editor}>
      <Canvas<TLShape>
        host={editor}
        shapeRenderer={renderer}
        canvasRef={container}
        tabIndex={0}
        role="application"
        aria-label="Design canvas"
        onTheCanvas={<EditingLayer editor={editor} />}
        inFrontOfCanvas={children}
      />
    </EditorContext.Provider>
  )
}
