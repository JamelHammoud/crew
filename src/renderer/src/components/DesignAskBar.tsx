import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEditor, useValue } from 'tldraw'
import { agentToAsk, agentsHere, askPrompt, lastAskAgent, rememberAskAgent } from '../design/askAgent'
import { askAnchor, type Box } from '../design/askAnchor'
import { layerName } from '../design/tools'
import { ArrowUpGlyph } from '../icons'
import { useCrew, type ThreadMeta } from '../state/store'
import AgentIcon from './AgentIcon'
import { AttachButton, AttachmentTray } from './Attachments'
import { MenuItem, Popover } from './Popover'
import Tooltip from './Tooltip'
import { useAutoResize } from './useAutoResize'
import { useBoardThreads } from './DesignChat'

// A line of the ask stands 20 tall in a field 8 taller than it, and the field
// grows to five lines before it scrolls, so the bar never swallows the board it
// is standing on. The shell is `rounded-card` on 6 of its own, which is the
// radius of the pet plus that padding: grown, the corners of the bar run
// parallel to the two circles standing in them.
const BAR = { w: 320, h: 42 }
const GROWN = 108

function threadFor(threads: ThreadMeta[], agentId: string): string | undefined {
  const mine = threads.filter(thread => thread.agentId === agentId && thread.status === 'open')
  return mine.length > 0 ? mine[mine.length - 1].id : undefined
}

export default function DesignAskBar({
  boardId,
  open,
  onClose,
  onSent
}: {
  boardId: string
  open: boolean
  onClose: () => void
  onSent?: () => void
}) {
  const editor = useEditor()
  const agents = useCrew(s => s.agents)
  const sendChat = useCrew(s => s.sendChat)
  const attach = useCrew(s => s.attach)
  const moveAttachments = useCrew(s => s.moveAttachments)
  const staged = useCrew(s => (s.pending[`ask:${boardId}`] ?? []).length)
  const threads = useBoardThreads(boardId)
  const [picked, setPicked] = useState<string | null>(lastAskAgent())
  const [switching, setSwitching] = useState(false)
  const [text, setText] = useState('')
  const [size, setSize] = useState<Box | null>(null)
  const inputRef = useAutoResize(text, GROWN)
  const barRef = useRef<HTMLDivElement>(null)

  const here = useMemo(() => agentsHere(agents), [agents])
  const agent = useMemo(() => agentToAsk(agents, picked), [agents, picked])

  // Viewport, not screen: the bar is drawn in the stage's own box, which starts
  // under the top bar and beside the panels. Screen coordinates put it that far
  // off the shape it belongs to.
  const target = useValue<Box | null>(
    'ask bar target',
    () => {
      const page = editor.getSelectionPageBounds()
      if (!page) return null
      const from = editor.pageToViewport({ x: page.minX, y: page.minY })
      const to = editor.pageToViewport({ x: page.maxX, y: page.maxY })
      return { x: from.x, y: from.y, w: to.x - from.x, h: to.y - from.y }
    },
    [editor]
  )
  const stage = useValue(
    'ask bar stage',
    () => {
      const box = editor.getViewportScreenBounds()
      return { w: box.w, h: box.h }
    },
    [editor]
  )
  const selected = useValue('ask bar selection', () => editor.getSelectedShapes(), [editor])
  const layers = useMemo(() => selected.map(shape => layerName(shape)).slice(0, 8), [selected])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
      return
    }
    setText('')
    setSize(null)
  }, [open])

  // Escape puts the bar away from wherever the caret has got to, so a click that
  // landed on the board does not leave it standing there with no way to close
  // it. While the agent picker is up the key belongs to the picker.
  useEffect(() => {
    if (!open || switching) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, switching, onClose])

  // The bar only ever talks about what is picked, so letting go of the selection
  // takes it down rather than leaving it hanging over the board asking about
  // nothing.
  useEffect(() => {
    if (open && selected.length === 0) onClose()
  }, [open, selected, onClose])

  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const next = { x: 0, y: 0, w: el.offsetWidth, h: el.offsetHeight }
    if (!next.w || !next.h) return
    if (size && size.w === next.w && size.h === next.h) return
    setSize(next)
  })

  if (!open) return null

  const key = `ask:${boardId}`
  const at = askAnchor(target, stage, { w: size?.w || BAR.w, h: size?.h || BAR.h })
  const ready = text.trim().length > 0 || staged > 0

  const send = () => {
    if (!ready || !agent) return
    const thread = threadFor(threads, agent.id)
    moveAttachments(key, thread ?? boardId)
    sendChat(askPrompt(agent.label, text, layers), thread, thread ? undefined : boardId, undefined, [agent.id])
    onSent?.()
    onClose()
  }

  const choose = (id: string) => {
    setPicked(id)
    rememberAskAgent(id)
    setSwitching(false)
    inputRef.current?.focus()
  }

  return (
    <div
      ref={barRef}
      className="absolute z-30 animate-pop w-80"
      style={{ left: at.x, top: at.y }}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    >
      <div
        className="glass glass-strong rounded-card p-1.5 cursor-text"
        onClick={() => inputRef.current?.focus()}
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault()
          void attach(key, event.dataTransfer.files)
        }}
      >
        {!agent ? (
          <p className="px-2 py-1.5 text-sm text-fg/45">No agents are here to ask right now.</p>
        ) : (
          <>
            <AttachmentTray attachmentKey={key} />
            <div className="flex items-end gap-1.5">
              <span className="relative shrink-0 flex">
                <Tooltip label={`Ask ${agent.label}`} disabled={switching}>
                  <button
                    onClick={event => {
                      event.stopPropagation()
                      setSwitching(value => !value)
                    }}
                    aria-label="Pick an agent"
                    aria-expanded={switching}
                    className={`h-7 w-7 rounded-full grid place-items-center transition-all cursor-pointer active:scale-95 ring-fg/25 ${
                      switching ? 'ring-2' : 'hover:ring-2'
                    }`}
                  >
                    <AgentIcon seed={agent.id} size="sm" />
                  </button>
                </Tooltip>
                <Popover open={switching} onClose={() => setSwitching(false)} side="top" align="start">
                  <div className="w-52">
                    {here.map(option => (
                      <MenuItem
                        key={option.id}
                        icon={<AgentIcon seed={option.id} size="xs" />}
                        label={option.label}
                        active={option.id === agent.id}
                        onClick={() => choose(option.id)}
                      />
                    ))}
                  </div>
                </Popover>
              </span>
              <textarea
                ref={inputRef}
                autoFocus
                rows={1}
                value={text}
                onChange={event => setText(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                    return
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    onClose()
                  }
                }}
                onPaste={event => void attach(key, event.clipboardData.files)}
                placeholder="Ask for a change"
                aria-label="Ask for a change"
                className="flex-1 min-w-0 py-1 bg-transparent text-sm leading-5 text-fg placeholder:text-fg/40 outline-none resize-none [scrollbar-width:none]"
              />
              <AttachButton attachmentKey={key} size="sm" />
              <Tooltip label="Send" className="shrink-0">
                <button
                  onClick={send}
                  disabled={!ready}
                  aria-label="Send"
                  className="w-7 h-7 shrink-0 rounded-full bg-fg text-ink-900 grid place-items-center transition-all duration-150 cursor-pointer hover:scale-105 active:scale-95 disabled:bg-fg/10 disabled:text-fg/40 disabled:scale-100"
                >
                  <ArrowUpGlyph className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
