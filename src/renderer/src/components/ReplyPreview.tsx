import { ArrowUturnLeftIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { EmojiText } from './Emoji'
import { replyTargetLabel } from './reply'
import Tooltip from './Tooltip'
import type { ThreadItem } from './thread'

export default function ReplyPreview({ replyTo, onCancel }: { replyTo: ThreadItem; onCancel?: () => void }) {
  return (
    <div className="mx-3 mb-2 flex min-w-0 items-center gap-3 rounded-card border border-ink-700 bg-ink-800 px-3 py-2.5 shadow-[0_8px_24px_rgb(0_0_0/0.2)]">
      <ArrowUturnLeftIcon className="h-4 w-4 shrink-0 text-fg-secondary" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-fg">{replyTargetLabel(replyTo.author, replyTo.self, replyTo.self)}</p>
        <p className="mt-0.5 truncate text-sm text-fg-muted">
          <EmojiText text={replyTo.text} />
        </p>
      </div>
      <Tooltip label="Cancel reply">
        <button
          type="button"
          aria-label="Cancel reply"
          onClick={onCancel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-muted transition-all hover:bg-fg/[0.06] hover:text-fg active:scale-95"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  )
}
