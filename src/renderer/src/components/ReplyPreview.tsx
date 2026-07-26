import { XMarkIcon } from '@heroicons/react/16/solid'
import { replyTargetLabel } from './reply'
import ReplyQuote from './ReplyQuote'
import Tooltip from './Tooltip'
import type { ThreadItem } from './thread'

export default function ReplyPreview({ replyTo, onCancel }: { replyTo: ThreadItem; onCancel?: () => void }) {
  return (
    <div className="animate-rise -mb-10 rounded-t-[30px] border border-b-0 border-ink-700 bg-ink-900 px-5 pb-12 pt-2">
      <div className="flex h-8 min-w-0 items-center gap-2">
        <ReplyQuote
          authorId={replyTo.authorId}
          authorName={replyTo.author}
          label={replyTargetLabel(replyTo.author, replyTo.self, replyTo.self)}
          text={replyTo.text}
          strong
        />
        <Tooltip label="Cancel reply">
          <button
            type="button"
            aria-label="Cancel reply"
            onClick={onCancel}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.08] hover:text-fg active:scale-95"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
