import { Fragment } from 'react'
import ChatMessage from './ChatMessage'
import DayDivider from './DayDivider'
import StepRow from './StepRow'
import type { ThreadItem } from './thread'
import { isNewDay } from './time'

const follows = (previous: ThreadItem | undefined, item: ThreadItem): boolean =>
  previous !== undefined &&
  (previous.kind === 'tool' || previous.kind === 'thinking') &&
  previous.promptId === item.promptId &&
  !isNewDay(previous.ts, item.ts)

export default function ThreadItems({
  items,
  onReply
}: {
  items: ThreadItem[]
  onReply?: (item: ThreadItem) => void
}) {
  return (
    <>
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {isNewDay(items[index - 1]?.ts, item.ts) && <DayDivider ts={item.ts} />}
          {item.kind === 'tool' || item.kind === 'thinking' ? (
            <StepRow item={item} linked={follows(items[index - 1], item)} />
          ) : (
            <ChatMessage item={item} onReply={onReply} />
          )}
        </Fragment>
      ))}
    </>
  )
}
