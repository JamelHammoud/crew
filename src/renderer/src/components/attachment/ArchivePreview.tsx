import { fileSize } from '../../../../shared/attachments'
import { entriesOf } from './archive'
import { Failed, Loading, Note } from './Frame'
import { useRead } from './useRead'

export default function ArchivePreview({ url }: { url: string }) {
  const { data, failed } = useRead(url, entriesOf)
  if (failed) return <Failed label="Could not read this file" />
  if (!data) return <Loading />
  if (data.length === 0) return <Note>Nothing in this file</Note>
  return (
    <div className="absolute inset-0 overflow-auto py-2 select-text">
      {data.map(entry => (
        <div key={entry.name} className="flex items-center gap-3 px-4 h-8 text-xs">
          <span className="flex-1 min-w-0 truncate font-mono text-fg-secondary">{entry.name}</span>
          <span className="shrink-0 tabular-nums text-fg-faint">{fileSize(entry.size)}</span>
        </div>
      ))}
    </div>
  )
}
