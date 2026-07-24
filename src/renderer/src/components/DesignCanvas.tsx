import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createTLStore,
  defaultBindingUtils,
  DefaultDashStyle,
  DefaultFontStyle,
  defaultShapeUtils,
  getSnapshot,
  InstancePresenceRecordType,
  loadSnapshot,
  Tldraw,
  useValue,
  type Editor,
  type TLComponents,
  type TldrawOptions,
  type TLPageId,
  type TLRecord,
  type TLShapeId,
  type TLStoreSnapshot,
  type TLUserId
} from 'tldraw'
import 'tldraw/tldraw.css'
import type { DesignPresence } from '../../../shared/design'
import { onDesign, useCrew } from '../state/store'
import { useTheme } from '../state/theme'
import AgentIcon, { petHue } from './AgentIcon'
import { designAssetUrls } from './designIcons'
import { DesignMenu, DesignNavigation, DesignStylePanel } from './DesignPanels'
import Spinner from './Spinner'

const assetUrls = designAssetUrls()

const components: TLComponents = {
  MenuPanel: DesignMenu,
  NavigationPanel: DesignNavigation,
  StylePanel: DesignStylePanel
}

const tldrawOptions: Partial<TldrawOptions> = { maxPages: 1 }

const FLUSH_MS = 80
const PRESENCE_MS = 100

const HUMAN_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb923c', '#f87171', '#4ade80']

function humanColor(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return HUMAN_COLORS[hash % HUMAN_COLORS.length]
}

export default function DesignCanvas({ boardId }: { boardId: string }) {
  const openDesign = useCrew(s => s.openDesign)
  const initDesign = useCrew(s => s.initDesign)
  const applyDesign = useCrew(s => s.applyDesign)
  const sendDesignPresence = useCrew(s => s.sendDesignPresence)
  const selfId = useCrew(s => s.selfId)
  const theme = useTheme()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [ready, setReady] = useState(false)
  const [agentCursors, setAgentCursors] = useState<Record<string, DesignPresence>>({})
  const selfIdRef = useRef(selfId)
  selfIdRef.current = selfId

  const store = useMemo(
    () => createTLStore({ shapeUtils: defaultShapeUtils, bindingUtils: defaultBindingUtils }),
    [boardId]
  )

  useEffect(() => {
    setReady(false)
    setAgentCursors({})
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
      if (presence.kind === 'agent') {
        setAgentCursors(prev => {
          if (presence.pageId === null || !presence.cursor) {
            if (!(presence.userId in prev)) return prev
            const next = { ...prev }
            delete next[presence.userId]
            return next
          }
          return { ...prev, [presence.userId]: presence }
        })
        return
      }
      const id = InstancePresenceRecordType.createId(presence.userId)
      store.mergeRemoteChanges(() => {
        if (presence.pageId === null || !presence.cursor) {
          if (store.has(id)) store.remove([id])
          return
        }
        try {
          store.put([
            InstancePresenceRecordType.create({
              id,
              userId: presence.userId as TLUserId,
              userName: presence.name,
              color: humanColor(presence.name),
              cursor: { x: presence.cursor.x, y: presence.cursor.y, type: 'default', rotation: 0 },
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
          } catch {
            // An unreadable document still leaves a working empty board.
          }
        } else if (!wasListening) {
          const document = getSnapshot(store).document
          initDesign(boardId, { store: document.store as Record<string, unknown>, schema: document.schema })
        }
        for (const presence of msg.presence) applyPresence(presence)
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
    let last = ''
    const timer = window.setInterval(() => {
      const point = editor.inputs.currentPagePoint
      const cursor = { x: Math.round(point.x), y: Math.round(point.y) }
      const selection = editor.getSelectedShapeIds() as string[]
      const pageId = editor.getCurrentPageId() as string
      const key = `${cursor.x},${cursor.y}|${selection.join(',')}|${pageId}`
      if (key === last) return
      last = key
      sendDesignPresence(boardId, cursor, selection, pageId)
    }, PRESENCE_MS)
    return () => window.clearInterval(timer)
  }, [ready, editor, boardId, sendDesignPresence])

  useEffect(() => {
    editor?.user.updateUserPreferences({ colorScheme: theme === 'light' ? 'light' : 'dark' })
  }, [editor, theme])

  const onMount = useCallback((mounted: Editor) => {
    mounted.setStyleForNextShapes(DefaultFontStyle, 'sans')
    mounted.setStyleForNextShapes(DefaultDashStyle, 'solid')
    setEditor(mounted)
  }, [])

  return (
    <div className="absolute inset-0 design">
      <Tldraw store={store} assetUrls={assetUrls} components={components} options={tldrawOptions} onMount={onMount} />
      <AgentCursors editor={editor} cursors={Object.values(agentCursors)} />
      {!ready && (
        <div className="absolute inset-0 bg-ink-950 light:bg-ink-800 flex items-center justify-center">
          <Spinner size={20} />
        </div>
      )}
    </div>
  )
}

function AgentCursors({ editor, cursors }: { editor: Editor | null; cursors: DesignPresence[] }) {
  const camera = useValue('design camera', () => (editor ? editor.getCamera() : null), [editor])
  if (!editor || camera === null) return null
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {cursors
        .filter(presence => presence.cursor)
        .map(presence => {
          const point = editor.pageToViewport({ x: presence.cursor!.x, y: presence.cursor!.y })
          return (
            <div
              key={presence.userId}
              className="absolute left-0 top-0 transition-transform duration-200 ease-linear will-change-transform"
              style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
            >
              <span
                className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full"
                style={{ background: `oklch(0.76 0.15 ${petHue(presence.userId)})` }}
              />
              <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full glass pl-1 pr-2.5 py-0.5 whitespace-nowrap">
                <AgentIcon seed={presence.userId} size="sm" />
                <span className="text-xs font-semibold text-fg">{presence.name}</span>
              </span>
            </div>
          )
        })}
    </div>
  )
}
