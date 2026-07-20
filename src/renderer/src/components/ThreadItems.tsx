import { Fragment } from 'react'
import ChatMessage from './ChatMessage'
import DayDivider from './DayDivider'
import StepRow from './StepRow'
import type { ThreadItem } from './thread'
import { isNewDay } from './time'

export default function ThreadItems({ items }: { items: ThreadItem[] }) {
  return (
    <>
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {isNewDay(items[index - 1]?.ts, item.ts) && <DayDivider ts={item.ts} />}
          {item.kind === 'tool' || item.kind === 'thinking' ? (
            <StepRow item={item} />
          ) : (
            <ChatMessage item={item} />
          )}
        </Fragment>
      ))}
    </>
  )
}
