import Skeleton from './Skeleton'

const rows = [
  { name: 'w-20', lines: ['w-4/5', 'w-3/5'] },
  { name: 'w-28', lines: ['w-2/3'] },
  { name: 'w-24', lines: ['w-5/6', 'w-1/2'] }
]

export default function ChatListSkeleton() {
  return (
    <div data-chat-list-skeleton className="space-y-8" aria-hidden>
      {rows.map((row, index) => (
        <div key={index} data-chat-skeleton-row className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <div className="flex items-center gap-2.5">
              <Skeleton className={`h-4 rounded-full ${row.name}`} />
              <Skeleton className="h-3 w-10 rounded-full" />
            </div>
            {row.lines.map(width => (
              <Skeleton key={width} className={`h-4 rounded-full ${width}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
