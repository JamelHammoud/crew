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
        <div key={item.id} className="relative">
          <img
            src={previewSrc(item)}
            alt={item.name}
            className="h-16 w-16 object-cover rounded-lg border border-zinc-800"
          />
          <button
            onClick={() => detach(attachmentKey, item.id)}
            title={`Remove ${item.name}`}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white"
          >
            ×
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
        className="flex items-center justify-center border border-zinc-800 text-zinc-300 rounded-lg h-[34px] w-[34px] text-lg leading-none hover:text-white hover:border-zinc-600 disabled:text-zinc-600 disabled:hover:border-zinc-800 shrink-0"
      >
        +
      </button>
    </>
  )
}
