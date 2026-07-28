import { Fragment, useMemo } from 'react'
import ChatMessage from './ChatMessage'
import DayDivider from './DayDivider'
import StepGroup from './StepGroup'
import StepRow from './StepRow'
import { sameRun, stepBlocks, type StepBlock, type ThreadItem } from './thread'
import { isNewDay } from './time'

const isStep = (item: ThreadItem | undefined): boolean => item?.kind === 'tool' || item?.kind === 'thinking'

const follows = (previous: StepBlock | undefined, block: StepBlock): boolean => {
  const before = previous?.items[previous.items.length - 1]
  const item = block.items[0]
  return (
    before !== undefined &&
    isStep(before) &&
    isStep(item) &&
    before.promptId === item.promptId &&
    !isNewDay(before.ts, item.ts)
  )
}

export default function ThreadItems({
  items,
  onReply
}: {
  items: ThreadItem[]
  onReply?: (item: ThreadItem) => void
}) {
  const blocks = useMemo(() => stepBlocks(items), [items])

  return (
    <>
      {blocks.map((block, index) => {
        const item = block.items[0]
        return (
          <Fragment key={block.key}>
            {isNewDay(blocks[index - 1]?.ts, block.ts) && <DayDivider ts={block.ts} />}
            {block.items.length > 1 ? (
              <StepGroup items={block.items} linked={follows(blocks[index - 1], block)} />
            ) : isStep(item) ? (
              <StepRow item={item} linked={follows(blocks[index - 1], block)} />
            ) : (
              <ChatMessage item={item} onReply={onReply} />
            )}
          </Fragment>
        )
      })}
    </>
  )
}
