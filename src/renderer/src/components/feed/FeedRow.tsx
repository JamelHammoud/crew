import { memo } from 'react'
import ChatMessage from '../ChatMessage'
import DayDivider from '../DayDivider'
import HuddleCard from '../huddle/HuddleCard'
import PlanCard from '../PlanCard'
import ThreadCard from '../ThreadCard'
import type { ThreadItem } from '../thread'
import { sameEntry, sameStatus, type FeedEntry, type ThreadStatus } from './feedItems'

interface FeedRowProps {
  entry: FeedEntry
  dayTs?: number
  linked: boolean
  planned: boolean
  status: ThreadStatus
  onOpenThread: (threadId: string) => void
  onReply: (item: ThreadItem) => void
}

function FeedRow({ entry, dayTs, linked, planned, status, onOpenThread, onReply }: FeedRowProps) {
  return (
    <>
      {dayTs !== undefined && <DayDivider ts={dayTs} />}
      {entry.kind === 'huddle' ? (
        <HuddleCard record={entry.record} />
      ) : entry.kind === 'card' ? (
        planned ? (
          <PlanCard thread={entry.thread} ts={entry.ts} onOpen={() => onOpenThread(entry.thread.id)} />
        ) : (
          <ThreadCard
            thread={entry.thread}
            ts={entry.ts}
            state={status.state}
            detail={status.detail}
            onOpen={() => onOpenThread(entry.thread.id)}
          />
        )
      ) : (
        <ChatMessage item={entry.item} editable linked={linked} onReply={onReply} />
      )}
    </>
  )
}

export default memo(
  FeedRow,
  (a, b) =>
    a.dayTs === b.dayTs &&
    a.linked === b.linked &&
    a.planned === b.planned &&
    a.onOpenThread === b.onOpenThread &&
    a.onReply === b.onReply &&
    sameStatus(a.status, b.status) &&
    sameEntry(a.entry, b.entry)
)
