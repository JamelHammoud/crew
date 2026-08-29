import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  createTLStore,
  defaultBindingUtils,
  getSnapshot,
  InstancePresenceRecordType,
  loadSnapshot,
  useValue,
  type Editor,
  type TLPageId,
  type TLRecord,
  type TLShapeId,
  type TLStoreSnapshot,
  type TLUserId
} from '../canvas'
import { CrewCanvas } from '../canvas/CrewCanvas'
import '../canvas/canvas.css'
import type { DesignPresence } from '../../../shared/design'
import {
  applyDesignCursors,
  applyToolCursor,
  ARROW_TIP,
  cursorColor,
  CursorArrow,
  DESIGN_CURSORS,
  showCursor
} from '../design/cursors'
import { busyAgents } from '../design/busyAgents'
import { resolveDesignAssetSource } from '../design/assetSource'
import { applyDesignDefaults } from '../design/defaults'
import { DesignNodeTool } from '../design/DesignNodeTool'
import SelectionOverlay from '../design/SelectionOverlay'
import { keepWholePixels } from '../design/wholePixels'
import { selectionStroke } from '../design/selectionColor'
import { designShapeUtils } from '../design/shapeUtils'
import { restoreView, watchView } from '../design/viewMemory'
import { onDesign, useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import { petHue } from './art/pet'
import Avatar from './Avatar'
import { avatarHue } from './avatarColor'
import Spinner from './Spinner'

const tools = [DesignNodeTool]

const CURSOR_EVENTS = ['pointermove', 'pointerdown', 'pointerup', 'pointerenter'] as const

const FLUSH_MS = 80
const PRESENCE_MS = 100

export default function DesignCanvas({
  boardId,
  asking,
  onEditor
}: {
  boardId: string
  asking?: boolean
  onEditor?: (editor: Editor | null) => void
}) {
  const openDesign = useCrew(s => s.openDesign)
  const initDesign = useCrew(s => s.initDesign)
  const applyDesign = useCrew(s => s.applyDesign)
  const sendDesignPresence = useCrew(s => s.sendDesignPresence)
  const httpBase = useCrew(s => s.httpBase)
  const selfId = useCrew(s => s.selfId)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [ready, setReady] = useState(false)
  const [cursors, setCursors] = useState<Record<string, DesignPresence>>({})
  const selfIdRef = useRef(selfId)
  selfIdRef.current = selfId
  const editorRef = useRef<Editor | null>(null)
  editorRef.current = editor
  const lastSpot = useRef<Record<string, DesignPresence>>({})
  const httpBaseRef = useRef(httpBase)
  httpBaseRef.current = httpBase

  const canvasOptions = useMemo(
    () => ({ resolveAssetUrl: (source: string) => resolveDesignAssetSource(httpBaseRef.current, source) }),
    []
  )

  const store = useMemo(
    () => createTLStore({ shapeUtils: designShapeUtils, bindingUtils: defaultBindingUtils }),
    [boardId]
  )

  useEffect(() => {
    setReady(false)
    setCursors({})
    let stopListen: (() => void) | null = null
    const pendingPut = new Map<string, TLRecord>()
    const pendingRemove = new Set<string>()
    let flushTimer: number | null = null

    const flush = () => {
      flushTimer = null
      if (pendingPut.size === 0 && pendingRemove.size === 0) return
      applyDesign(boardId, [...pendingPut.values()], [...pendingRemove])
      pendingPut.clear()
      pendingRemove.clear()
    }

    const listen = () => {
      if (stopListen) return
      stopListen = store.listen(
        entry => {
          for (const record of Object.values(entry.changes.added)) {
            pendingRemove.delete(record.id)
            pendingPut.set(record.id, record)
          }
          for (const [, to] of Object.values(entry.changes.updated)) pendingPut.set(to.id, to)
          for (const record of Object.values(entry.changes.removed)) {
            pendingPut.delete(record.id)
            pendingRemove.add(record.id)
          }
          if (flushTimer === null) flushTimer = window.setTimeout(flush, FLUSH_MS)
        },
        { source: 'user', scope: 'document' }
      )
    }

    const applyPresence = (presence: DesignPresence) => {
      if (presence.userId === selfIdRef.current) return
      if (presence.kind === 'agent' && presence.cursor) lastSpot.current[presence.userId] = presence
      setCursors(prev => {
        if (presence.pageId === null || !presence.cursor) {
          if (!(presence.userId in prev)) return prev
          const next = { ...prev }
          delete next[presence.userId]
          return next
        }
        return { ...prev, [presence.userId]: presence }
      })
      if (presence.kind === 'agent') return
      const id = InstancePresenceRecordType.createId(presence.userId)
      const at = presence.cursor ?? { x: 0, y: 0 }
      store.mergeRemoteChanges(() => {
        if (presence.pageId === null) {
          if (store.has(id)) store.remove([id])
          return
        }
        try {
          store.put([
            InstancePresenceRecordType.create({
              id,
              userId: presence.userId as TLUserId,
              userName: presence.name,
              color: cursorColor(avatarHue(presence.name)),
              cursor: { x: at.x, y: at.y, type: 'default', rotation: 0 },
              selectedShapeIds: presence.selection as TLShapeId[],
              currentPageId: presence.pageId as TLPageId,
              lastActivityTimestamp: Date.now()
            })
          ])
        } catch {
          return
        }
      })
    }

    const unsubscribe = onDesign(msg => {
      if (msg.boardId !== boardId) return
      if (msg.type === 'design.snapshot') {
        const wasListening = stopListen !== null
        stopListen?.()
        stopListen = null
        if (msg.document) {
          try {
            loadSnapshot(store, { store: msg.document.store, schema: msg.document.schema } as TLStoreSnapshot)
          } catch {}
        } else if (!wasListening) {
          const document = getSnapshot(store).document
          initDesign(boardId, { store: document.store as Record<string, unknown>, schema: document.schema })
        }
        for (const presence of msg.presence) applyPresence(presence)
        if (editorRef.current) applyDesignDefaults(editorRef.current)
        listen()
        setReady(true)
        return
      }
      if (!stopListen) return
      if (msg.type === 'design.changes') {
        store.mergeRemoteChanges(() => {
          const put = (msg.put ?? []) as TLRecord[]
          if (put.length > 0) {
            try {
              store.put(put)
            } catch {
              for (const record of put) {
                try {
                  store.put([record])
                } catch {
                  continue
                }
              }
            }
          }
          const gone = (msg.remove ?? []).filter(id => store.has(id as TLRecord['id'])) as Array<TLRecord['id']>
          if (gone.length > 0) store.remove(gone)
        })
        return
      }
      if (msg.type !== 'design.presence') return
      applyPresence(msg.presence)
    })

    openDesign(boardId)

    return () => {
      unsubscribe()
      stopListen?.()
      if (flushTimer !== null) window.clearTimeout(flushTimer)
      flush()
      sendDesignPresence(boardId, null, [], null)
    }
  }, [boardId, store, openDesign, initDesign, applyDesign, sendDesignPresence])

  useEffect(() => {
    if (!ready || !editor) return
    const container = editor.getContainer()
    let last = ''
    let over = true
    const onEnter = () => {
      over = true
    }
    const onLeave = () => {
      over = false
    }
    container.addEventListener('pointerenter', onEnter)
    container.addEventListener('pointerleave', onLeave)
    const timer = window.setInterval(() => {
      const point = editor.inputs.currentPagePoint
      const cursor = over ? { x: Math.round(point.x), y: Math.round(point.y) } : null
      const selection = editor.getSelectedShapeIds() as string[]
      const pageId = editor.getCurrentPageId() as string
      const key = `${cursor ? `${cursor.x},${cursor.y}` : 'away'}|${selection.join(',')}|${pageId}`
      if (key === last) return
      last = key
      sendDesignPresence(boardId, cursor, selection, pageId)
    }, PRESENCE_MS)
    return () => {
      container.removeEventListener('pointerenter', onEnter)
      container.removeEventListener('pointerleave', onLeave)
      window.clearInterval(timer)
    }
  }, [ready, editor, boardId, sendDesignPresence])

  useEffect(() => {
    if (ready && editor) applyDesignDefaults(editor)
  }, [ready, editor])

  useEffect(() => {
    if (!ready || !editor) return
    restoreView(editor, boardId)
    return watchView(editor, boardId)
  }, [ready, editor, boardId])

  const selected = useValue('design selected color', () => (editor ? selectionStroke(editor) : null), [editor])

  const tool = useValue('design tool cursor', () => editor?.getCurrentToolId() ?? '', [editor])

  useEffect(() => {
    if (!editor) return
    const container = editor.getContainer()
    applyToolCursor(container, tool)
    let worn = ''
    const wear = () => {
      const type = editor.getInstanceState().cursor.type
      if (type === worn) return
      worn = type
      showCursor(container, type)
    }
    wear()
    for (const name of CURSOR_EVENTS) container.addEventListener(name, wear)
    return () => {
      for (const name of CURSOR_EVENTS) container.removeEventListener(name, wear)
    }
  }, [editor, tool])

  const onMount = useCallback(
    (mounted: Editor) => {
      applyDesignDefaults(mounted)
      applyDesignCursors(mounted.getContainer())
      mounted.user.updateUserPreferences({ isSnapMode: true, colorScheme: 'light' })
      const stopRounding = keepWholePixels(mounted)
      setEditor(mounted)
      onEditor?.(mounted)
      return () => {
        stopRounding()
        onEditor?.(null)
      }
    },
    [onEditor]
  )

  return (
    <div
      className="absolute inset-0 design"
      style={
        {
          ...DESIGN_CURSORS,
          cursor: 'var(--crew-cursor-default)',
          '--design-selected': selected
        } as CSSProperties
      }
    >
      <CrewCanvas store={store} shapeUtils={designShapeUtils} tools={tools} options={canvasOptions} onMount={onMount} />
      <SelectionOverlay editor={editor} asking={asking} />
      <RemoteCursors editor={editor} boardId={boardId} live={cursors} held={lastSpot} />
      {!ready && (
        <div className="absolute inset-0 bg-ink-950 light:bg-ink-800 flex items-center justify-center">
          <Spinner size={20} />
        </div>
      )}
    </div>
  )
}

function RemoteCursors({
  editor,
  boardId,
  live,
  held
}: {
  editor: Editor | null
  boardId: string
  live: Record<string, DesignPresence>
  held: { current: Record<string, DesignPresence> }
}) {
  const threads = useCrew(s => s.threads)
  const threadPrompts = useCrew(s => s.threadPrompts)
  const agents = useCrew(s => s.agents)
  const camera = useValue('design camera', () => (editor ? editor.getCamera() : null), [editor])
  const pageId = useValue('design page', () => (editor ? editor.getCurrentPageId() : null), [editor])
  const middle = useValue('design middle', () => editor?.getCurrentPageBounds()?.center ?? null, [editor])

  const busy = useMemo(
    () =>
      busyAgents(
        boardId,
        Object.values(threads),
        threadPrompts,
        Object.fromEntries(agents.map(agent => [agent.id, agent.label]))
      ),
    [boardId, threads, threadPrompts, agents]
  )

  if (!editor || camera === null || pageId === null) return null

  const working = new Set(busy.map(agent => agent.id))
  const standing: DesignPresence[] = busy
    .filter(agent => !live[agent.id])
    .map(agent => {
      const spot = held.current[agent.id]
      const cursor = spot?.cursor ?? (middle ? { x: middle.x, y: middle.y } : null)
      return { userId: agent.id, name: agent.label, kind: 'agent', cursor, selection: [], pageId, ts: 0 }
    })

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Object.values(live), ...standing]
        .filter(presence => presence.cursor && presence.pageId === pageId)
        .map(presence => {
          const point = editor.pageToViewport({ x: presence.cursor!.x, y: presence.cursor!.y })
          const agent = presence.kind === 'agent'
          const color = cursorColor(agent ? petHue(presence.userId) : avatarHue(presence.name))
          return (
            <div
              key={presence.userId}
              className="absolute left-0 top-0 transition-transform duration-200 ease-linear will-change-transform"
              style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
            >
              <span className="absolute" style={{ left: -ARROW_TIP.x, top: -ARROW_TIP.y }}>
                <CursorArrow color={color} />
              </span>
              <span className="absolute left-[11px] top-[14px] flex items-center gap-1.5 rounded-full glass glass-strong pl-1 pr-2.5 py-0.5 whitespace-nowrap">
                {agent ? <AgentIcon seed={presence.userId} size="sm" /> : <Avatar name={presence.name} size="sm" />}
                <span className="text-xs font-semibold text-fg">{presence.name}</span>
                {working.has(presence.userId) && <Spinner size={11} />}
              </span>
            </div>
          )
        })}
    </div>
  )
}
