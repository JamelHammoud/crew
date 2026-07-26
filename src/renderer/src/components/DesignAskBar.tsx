import { ArrowUpIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, useValue } from 'tldraw'
import { agentToAsk, agentsHere, askPrompt, lastAskAgent, rememberAskAgent } from '../design/askAgent'
import { layerName } from '../design/tools'
import { useCrew, type ThreadMeta } from '../state/store'
import AgentIcon from './AgentIcon'
import { AttachButton, AttachmentTray } from './Attachments'
import { MenuItem, Popover } from './Popover'
import Tooltip from './Tooltip'
import { useBoardThreads } from './DesignChat'

const LIFT = 12

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
  const threads = useBoardThreads(boardId)
  const [picked, setPicked] = useState<string | null>(lastAskAgent())
  const [switching, setSwitching] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const here = useMemo(() => agentsHere(agents), [agents])
  const agent = useMemo(() => agentToAsk(agents, picked), [agents, picked])

  // Viewport, not screen: the bar is drawn in the stage's own box, which starts
  // under the top bar and beside the panels. Screen coordinates put it that far
  // off the shape it belongs to.
  const bounds = useValue(
    'ask bar bounds',
    () => {
      const page = editor.getSelectionPageBounds()
      return page ? editor.pageToViewport({ x: page.minX, y: page.maxY }) : null
    },
    [editor]
  )
  const selected = useValue('ask bar selection', () => editor.getSelectedShapes(), [editor])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
    else setText('')
  }, [open])

  useEffect(() => {
    if (open && selected.length === 0) onClose()
  }, [open, selected, onClose])

  if (!open || !bounds) return null

  const key = `ask:${boardId}`
  const layers = selected.map(shape => layerName(shape)).slice(0, 8)

  const send = () => {
    if (!text.trim() || !agent) return
    const thread = threadFor(threads, agent.id)
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
      className="absolute z-30 animate-pop"
      style={{ left: bounds.x, top: bounds.y + LIFT, minWidth: 320 }}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    >
      <div className="glass glass-strong rounded-shell px-2 py-2 w-80">
        {!agent ? (
          <p className="px-2 py-1.5 text-sm text-fg/45">No agents are here to ask right now.</p>
        ) : (
          <>
            <AttachmentTray attachmentKey={key} />
            <div className="flex items-center gap-1.5">
              <span className="relative shrink-0">
                <Tooltip label={`Ask ${agent.label}`} disabled={switching}>
                  <button
                    onClick={() => setSwitching(value => !value)}
                    aria-label="Pick an agent"
                    aria-expanded={switching}
                    className="w-8 h-8 rounded-full grid place-items-center transition-transform active:scale-95 hover:bg-fg/[0.06]"
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
              <input
                ref={inputRef}
                autoFocus
                value={text}
                onChange={event => setText(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    send()
                    return
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    onClose()
                  }
                }}
                placeholder="Ask for a change"
                aria-label="Ask for a change"
                className="flex-1 min-w-0 h-8 bg-transparent text-sm text-fg placeholder:text-fg/35 outline-none"
              />
              <AttachButton attachmentKey={key} size="sm" />
              <button
                onClick={send}
                disabled={!text.trim()}
                aria-label="Send"
                className="w-8 h-8 shrink-0 rounded-full bg-fg text-ink-900 grid place-items-center transition-all active:scale-95 disabled:opacity-25"
              >
                <ArrowUpIcon className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
