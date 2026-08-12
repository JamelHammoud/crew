import { useEffect, useRef, useState } from 'react'
import { MEMORY_TEXT_LIMIT, type CrewMemory } from '../../../../shared/memory'
import { MoreGlyph, PencilGlyph, PlusGlyph, TrashGlyph } from '../../icons'
import { useCrew } from '../../state/store'
import AgentIcon from '../AgentIcon'
import Avatar from '../Avatar'
import Modal from '../Modal'
import { MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'
import Toggle from '../Toggle'
import { Page, Row, Section } from './parts'

const FIELD =
  'w-full h-24 px-3.5 py-3 rounded-xl bg-fg/[0.07] text-sm text-fg placeholder:text-fg/35 outline-none border-none resize-none transition-colors focus:bg-fg/[0.11]'

function LineCard({
  open,
  title,
  action,
  text: given,
  onClose,
  onSubmit
}: {
  open: boolean
  title: string
  action: string
  text: string
  onClose: () => void
  onSubmit: (text: string) => string | null
}) {
  const [text, setText] = useState(given)
  const [trouble, setTrouble] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    setText(given)
    setTrouble('')
    const box = field.current
    if (!box) return
    box.focus()
    box.select()
  }, [open, given])

  const send = () => {
    if (!text.trim()) return
    const said = onSubmit(text)
    if (said) setTrouble(said)
    else onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="mt-4">
        <textarea
          ref={field}
          value={text}
          maxLength={MEMORY_TEXT_LIMIT}
          placeholder="The tests boot real servers, so run one suite at a time"
          aria-label="Memory"
          onChange={event => setText(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter' || event.shiftKey) return
            event.preventDefault()
            send()
          }}
          className={FIELD}
        />
      </div>
      {trouble && <p className="mt-2.5 text-sm text-danger">{trouble}</p>}
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
        >
          Cancel
        </button>
        <button
          onClick={send}
          disabled={!text.trim()}
          className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:bg-fg/10 disabled:text-fg/45"
        >
          {action}
        </button>
      </div>
    </Modal>
  )
}

function MemoryRow({ memory }: { memory: CrewMemory }) {
  const editMemory = useCrew(s => s.editMemory)
  const removeMemory = useCrew(s => s.removeMemory)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 -mx-3 rounded-2xl transition-colors hover:bg-fg/[0.03]">
      <span className="flex-1 min-w-0 text-base text-fg select-text">{memory.text}</span>
      <span className="shrink-0 flex items-center gap-2 max-w-[160px] text-sm text-fg/45">
        {memory.byAgentId ? <AgentIcon seed={memory.byAgentId} size="xs" /> : <Avatar name={memory.by} px={20} />}
        <span className="truncate">{memory.by}</span>
      </span>
      <span className="relative shrink-0 flex">
        <Tooltip label="More" disabled={open}>
          <button
            onClick={() => setOpen(was => !was)}
            aria-label={`More for ${memory.text}`}
            aria-expanded={open}
            aria-haspopup="menu"
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 hover:bg-fg/10 hover:text-fg active:scale-95 focus-visible:opacity-100 ${
              open ? 'bg-fg/10 text-fg opacity-100' : 'text-fg/45 opacity-0 group-hover:opacity-100'
            }`}
          >
            <MoreGlyph className="w-4 h-4" />
          </button>
        </Tooltip>
        <Popover open={open} onClose={() => setOpen(false)} className="w-52">
          <MenuItem
            icon={<PencilGlyph />}
            label="Edit memory"
            onClick={() => {
              setOpen(false)
              setEditing(true)
            }}
          />
          <MenuItem
            icon={<TrashGlyph />}
            danger
            label="Delete memory"
            onClick={() => {
              setOpen(false)
              removeMemory(memory.id)
            }}
          />
        </Popover>
      </span>
      <LineCard
        open={editing}
        title="Edit memory"
        action="Save"
        text={memory.text}
        onClose={() => setEditing(false)}
        onSubmit={text => editMemory(memory.id, text)}
      />
    </div>
  )
}

function AddMemory() {
  const addMemory = useCrew(s => s.addMemory)
  const [writing, setWriting] = useState(false)

  return (
    <>
      <button
        onClick={() => setWriting(true)}
        className="group w-full flex items-center gap-3 px-5 py-4 rounded-card border border-fg/[0.09] text-left transition-colors duration-200 hover:border-fg/20 hover:bg-fg/[0.03] active:scale-[0.995]"
      >
        <span className="w-10 h-10 rounded-full bg-fg/[0.07] flex items-center justify-center text-fg/70 transition-colors duration-200 group-hover:bg-fg/[0.12] group-hover:text-fg">
          <PlusGlyph className="w-[18px] h-[18px]" />
        </span>
        <span className="text-base font-semibold text-fg">Add a memory</span>
      </button>
      <LineCard
        open={writing}
        title="Add a memory"
        action="Add"
        text=""
        onClose={() => setWriting(false)}
        onSubmit={addMemory}
      />
    </>
  )
}

export default function Memory() {
  const memories = useCrew(s => s.memories)
  const enabled = useCrew(s => s.memoryEnabled)
  const setEnabled = useCrew(s => s.setMemoryEnabled)

  return (
    <Page title="Memory">
      <Section>
        <Row label="Let agents use memory">
          <Toggle on={enabled} label="Let agents use memory" onChange={setEnabled} />
        </Row>
      </Section>
      <div aria-hidden className="mt-7 -mx-8 border-t border-fg/[0.07]" />
      <Section>
        {memories.length > 0 && (
          <div className="space-y-0.5 mb-4">
            {memories.map(one => (
              <MemoryRow key={one.id} memory={one} />
            ))}
          </div>
        )}
        <AddMemory />
      </Section>
    </Page>
  )
}
