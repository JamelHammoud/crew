import { markRuns } from '../../../shared/files'

export default function Marked({ text, hits, on }: { text: string; hits: number[]; on?: string }) {
  return (
    <>
      {markRuns(text, hits).map((run, index) => (
        <span key={index} className={run.hit ? (on ?? 'text-fg') : undefined}>
          {run.text}
        </span>
      ))}
    </>
  )
}
