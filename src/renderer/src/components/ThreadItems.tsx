import ChatMessage from './ChatMessage'
import StepRow from './StepRow'
import type { ThreadItem } from './thread'

export default function ThreadItems({
  items,
  onStop
}: {
  items: ThreadItem[]
  onStop?: (promptId: string) => void
}) {
  return (
    <>
      {items.map(item =>
        item.kind === 'tool' || item.kind === 'thinking' ? (
          <StepRow key={item.key} item={item} />
        ) : (
          <ChatMessage key={item.key} item={item} onStop={onStop} />
        )
      )}
    </>
  )
}
