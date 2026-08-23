import { Fragment, memo, useMemo } from 'react'
import ChatMessage from './ChatMessage'
import DayDivider from './DayDivider'
import PageRow from './PageRow'
import StepGroup from './StepGroup'
import StepRow from './StepRow'
import SubagentChips from './SubagentChips'
import SubagentMessage from './SubagentMessage'
import { sameRun, stepBlocks, type StepBlock, type ThreadItem } from './thread'
import { isNewDay } from './time'

const isStep = (item: ThreadItem | undefined): boolean => item?.kind === 'tool' || item?.kind === 'thinking'

const inRun = (item: ThreadItem | undefined): boolean => isStep(item) || item?.kind === 'page'

const follows = (previous: StepBlock | undefined, block: StepBlock): boolean => {
  const before = previous?.items[previous.items.length - 1]
  const item = block.items[0]
  return (
    before !== undefined &&
    inRun(before) &&
    inRun(item) &&
    item.promptId !== undefined &&
    before.promptId === item.promptId &&
    !isNewDay(before.ts, item.ts)
  )
}

function ThreadItems({
  items,
  threadId = '',
  onReply
}: {
  items: ThreadItem[]
  // Which thread these are, so the row of helpers has somewhere to send you
  // when there are more of them than the row shows.
  threadId?: string
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
            {item.kind === 'subagent' ? (
              <SubagentChips runs={item.runs ?? []} threadId={threadId} />
            ) : item.kind === 'subagent-message' ? (
              <SubagentMessage item={item} threadId={threadId} />
            ) : item.kind === 'page' && item.shown ? (
              <PageRow shown={item.shown} linked={follows(blocks[index - 1], block)} />
            ) : block.items.length > 1 ? (
              <StepGroup items={block.items} linked={follows(blocks[index - 1], block)} />
            ) : isStep(item) ? (
              <StepRow item={item} linked={follows(blocks[index - 1], block)} />
            ) : (
              <ChatMessage item={item} onReply={onReply} linked={sameRun(blocks[index - 1]?.items.at(-1), item)} />
            )}
          </Fragment>
        )
      })}
    </>
  )
}

export default memo(ThreadItems)
