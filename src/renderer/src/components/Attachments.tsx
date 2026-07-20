import { PlusIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { useRef } from 'react'
import { MAX_ATTACHMENTS } from '../../../shared/attachments'
import { useCrew } from '../state/store'
import { previewSrc } from './images'

export function AttachmentTray({ attachmentKey }: { attachmentKey: string }) {
  const pending = useCrew(s => s.pending[attachmentKey])
  const detach = useCrew(s => s.detach)
  if (!pending || pending.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {pending.map(item => (
        <div key={item.id} className="relative group animate-pop">
          <img
            src={previewSrc(item)}
            alt={item.name}
            className="h-16 w-16 object-cover rounded-xl border border-white/10"
          />
          <button
            onClick={() => detach(attachmentKey, item.id)}
            title={`Remove ${item.name}`}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full glass flex items-center justify-center text-fg-secondary opacity-0 group-hover:opacity-100 hover:text-fg transition-opacity"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function AttachButton({ attachmentKey }: { attachmentKey: string }) {
  const count = useCrew(s => (s.pending[attachmentKey] ?? []).length)
  const attach = useCrew(s => s.attach)
  const inputRef = useRef<HTMLInputElement>(null)
  const full = count >= MAX_ATTACHMENTS
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={event => {
          void attach(attachmentKey, event.target.files)
          event.target.value = ''
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={full}
        title={full ? `Up to ${MAX_ATTACHMENTS} images` : 'Add an image'}
        aria-label="Add an image"
        className="w-10 h-10 rounded-full border border-ink-600 flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:border-ink-500 hover:bg-white/[0.06] active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-ink-600 shrink-0"
      >
        <PlusIcon className="w-5 h-5" />
      </button>
    </>
  )
}
