import { sayCadence, type Schedule } from '../../../../shared/schedules'
import { BoltGlyph, PauseGlyph, PencilGlyph, PlayGlyph, TrashGlyph } from '../../icons'
import ToolMarkView from '../toolMark'
import Tooltip from '../Tooltip'

const sinceWords = (ms: number): string => {
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const BUTTON =
  'w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg/45 opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100 active:scale-90'

export default function ScheduleRow({
  schedule,
  onPause,
  onRun,
  onEdit,
  onRemove
}: {
  schedule: Schedule
  onPause: () => void
  onRun: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const { name, paused, lastRunAt } = schedule
  const ran = lastRunAt ? `Last ran ${sinceWords(Date.now() - lastRunAt)}` : ''
  const hold = paused ? `Start ${name} again` : `Pause ${name}`

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 -mx-3 rounded-2xl transition-colors hover:bg-fg/[0.03]">
      <span className="w-10 h-10 shrink-0 rounded-full bg-fg/[0.07] flex items-center justify-center text-fg/70">
        <ToolMarkView mark={schedule.mark} className="w-[18px] h-[18px]" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-base text-fg truncate">{name}</span>
        <span className="block text-sm text-fg-muted truncate">
          {ran ? `${sayCadence(schedule.when)} · ${ran}` : sayCadence(schedule.when)}
        </span>
      </span>
      <Tooltip label={hold}>
        <button onClick={onPause} aria-label={hold} className={`${BUTTON} hover:bg-fg/10 hover:text-fg`}>
          {paused ? <PlayGlyph className="w-4 h-4" /> : <PauseGlyph className="w-4 h-4" />}
        </button>
      </Tooltip>
      <Tooltip label={`Run ${name} now`}>
        <button onClick={onRun} aria-label={`Run ${name} now`} className={`${BUTTON} hover:bg-fg/10 hover:text-fg`}>
          <BoltGlyph className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip label={`Edit ${name}`}>
        <button onClick={onEdit} aria-label={`Edit ${name}`} className={`${BUTTON} hover:bg-fg/10 hover:text-fg`}>
          <PencilGlyph className="w-4 h-4" />
        </button>
      </Tooltip>
      <Tooltip label={`Take ${name} out`}>
        <button
          onClick={onRemove}
          aria-label={`Take ${name} out`}
          className={`${BUTTON} hover:bg-danger/10 hover:text-danger`}
        >
          <TrashGlyph className="w-4 h-4" />
        </button>
      </Tooltip>
    </div>
  )
}
