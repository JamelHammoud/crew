import { CheckIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import Pill from './Pill'
import Tooltip from './Tooltip'

export interface QueuedMessage {
  promptId: string
  author: string
  self: boolean
  text: string
  agentLabel?: string
}

function QueueRow({
  item,
  onEdit,
  onRemove
}: {
  item: QueuedMessage
  onEdit: (text: string) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.text)

  const commit = () => {
    if (draft.trim() && draft.trim() !== item.text) onEdit(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="flex-1 min-w-0 bg-ink-800 rounded-lg px-2.5 py-1 text-sm text-fg outline-none"
        />
        <Tooltip label="Save">
          <button
            onClick={commit}
            aria-label="Save"
            className="w-6 h-6 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-white/[0.08] transition-colors shrink-0"
          >
            <CheckIcon className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        <Tooltip label="Cancel">
          <button
            onClick={() => setEditing(false)}
            aria-label="Cancel"
            className="w-6 h-6 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-white/[0.08] transition-colors shrink-0"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2 py-0.5">
      <span className="text-sm font-semibold text-fg-muted shrink-0">{item.author}</span>
      <span className="text-sm text-fg-secondary truncate flex-1">{item.text}</span>
      {item.agentLabel && (
        <span className="shrink-0">
          <Pill>{item.agentLabel}</Pill>
        </span>
      )}
      {item.self && (
        <span className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Tooltip label="Edit">
            <button
              onClick={() => {
                setDraft(item.text)
                setEditing(true)
              }}
              aria-label="Edit queued message"
              className="w-6 h-6 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-white/[0.08] transition-colors"
            >
              <PencilIcon className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="Remove from queue">
            <button
              onClick={onRemove}
              aria-label="Remove from queue"
              className="w-6 h-6 rounded-full flex items-center justify-center text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </span>
      )}
    </div>
  )
}

export default function QueueBar({
  items,
  onEdit,
  onRemove
}: {
  items: QueuedMessage[]
  onEdit: (promptId: string, text: string) => void
  onRemove: (promptId: string) => void
}) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="bg-ink-900 border border-b-0 border-ink-700 rounded-t-[30px] px-5 pt-1.5 pb-12 -mb-10">
      <button
        onClick={() => setOpen(o => !o)}
        className="group w-full flex items-center gap-2 h-8 text-sm font-semibold text-fg-muted hover:text-fg-secondary transition-colors"
      >
        {items.length === 1 ? '1 message queued' : `${items.length} messages queued`}
        <ChevronDownIcon
          strokeWidth={3}
          className={`w-4 h-4 ml-auto text-fg-muted group-hover:text-fg-secondary transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="pb-1.5 space-y-0.5">
          {items.map(item => (
            <QueueRow
              key={item.promptId}
              item={item}
              onEdit={text => onEdit(item.promptId, text)}
              onRemove={() => onRemove(item.promptId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
