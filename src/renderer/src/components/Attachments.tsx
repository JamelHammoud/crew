import { DocumentIcon, PlusIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { useRef } from 'react'
import { isImageType, MAX_ATTACHMENTS } from '../../../shared/attachments'
import { useCrew } from '../state/store'
import { previewSrc } from './images'
import Tooltip from './Tooltip'

export function AttachmentTray({ attachmentKey }: { attachmentKey: string }) {
  const pending = useCrew(s => s.pending[attachmentKey])
  const detach = useCrew(s => s.detach)
  if (!pending || pending.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {pending.map(item => (
        <div key={item.id} className="relative group animate-pop">
          {isImageType(item.mime) ? (
            <img src={previewSrc(item)} alt={item.name} className="h-16 w-16 object-cover rounded-xl border border-fg/10" />
          ) : (
            <div className="h-16 w-28 px-2 flex flex-col items-center justify-center gap-1 rounded-xl border border-fg/10 bg-fg/[0.04] text-fg-muted">
              <DocumentIcon className="w-5 h-5" />
              <span className="w-full truncate text-center text-[9px]">{item.name}</span>
            </div>
          )}
          <Tooltip label={`Remove ${item.name}`}>
            <button
              onClick={() => detach(attachmentKey, item.id)}
              aria-label={`Remove ${item.name}`}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full glass flex items-center justify-center text-fg-secondary opacity-0 group-hover:opacity-100 hover:text-fg transition-opacity"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </Tooltip>
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
      <Tooltip label={full ? `Up to ${MAX_ATTACHMENTS} images` : 'Add an image'}>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={full}
          aria-label="Add an image"
          className="w-10 h-10 rounded-full border border-ink-600 flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:border-ink-500 hover:bg-fg/[0.06] active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-ink-600 shrink-0"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </Tooltip>
    </>
  )
}
