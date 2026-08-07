import { DAY_MINUTES, EVERY_MAX, EVERY_MIN, type Cadence } from '../../../../shared/schedules'
import Select from '../Select'
import { clockOf, Day, Line, minutesOf, MORNING, PILL_INPUT, Word } from './parts'

const KINDS: Array<{ kind: Cadence['kind']; label: string }> = [
  { kind: 'every', label: 'Every' },
  { kind: 'daily', label: 'Every day' },
  { kind: 'weekly', label: 'Certain days' },
  { kind: 'monthly', label: 'Every month' }
]

const STEPS = [15, 30, 60, 120, 180, 240, 360, 480, 720, DAY_MINUTES, DAY_MINUTES * 2, DAY_MINUTES * 3, EVERY_MAX]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const WEEKDAYS = [1, 2, 3, 4, 5]

const amount = (minutes: number): string => {
  if (minutes % DAY_MINUTES === 0) {
    const days = minutes / DAY_MINUTES
    return days === 1 ? '1 day' : `${days} days`
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  return `${minutes} minutes`
}

const ordinal = (day: number): string => {
  const tens = day % 100
  if (tens > 3 && tens < 21) return `${day}th`
  return `${day}${['th', 'st', 'nd', 'rd'][day % 10] ?? 'th'}`
}

export default function ScheduleWhen({
  when,
  onChange
}: {
  when: Cadence
  onChange: (when: Cadence) => void
}) {
  const at = when.kind === 'every' ? MORNING : when.at
  const days = when.kind === 'weekly' ? when.days : WEEKDAYS

  const pick = (kind: Cadence['kind']) => {
    if (kind === when.kind) return
    if (kind === 'every') onChange({ kind: 'every', minutes: EVERY_MIN })
    else if (kind === 'daily') onChange({ kind: 'daily', at })
    else if (kind === 'weekly') onChange({ kind: 'weekly', days, at })
    else onChange({ kind: 'monthly', day: 1, at })
  }

  const toggle = (day: number) => {
    const next = days.includes(day) ? days.filter(one => one !== day) : [...days, day].sort()
    if (next.length > 0) onChange({ kind: 'weekly', days: next, at })
  }

  const setAt = (written: string) => {
    const minutes = minutesOf(written, at)
    if (when.kind === 'weekly') onChange({ kind: 'weekly', days, at: minutes })
    else if (when.kind === 'monthly') onChange({ kind: 'monthly', day: when.day, at: minutes })
    else onChange({ kind: 'daily', at: minutes })
  }

  const time = (
    <input
      type="time"
      value={clockOf(at)}
      aria-label="Time"
      onChange={event => setAt(event.target.value)}
      className={PILL_INPUT}
    />
  )

  return (
    <div className="space-y-3">
      <Line>
        <Select
          name="How often it runs"
          value={when.kind}
          options={KINDS.map(one => ({ value: one.kind, label: one.label }))}
          onChange={value => pick(value as Cadence['kind'])}
        />

        {when.kind === 'every' && (
          <Select
            name="How often"
            value={String(when.minutes)}
            options={STEPS.map(minutes => ({ value: String(minutes), label: amount(minutes) }))}
            onChange={value => onChange({ kind: 'every', minutes: Number(value) })}
          />
        )}

        {when.kind === 'monthly' && (
          <>
            <Word>on the</Word>
            <Select
              name="Day of the month"
              value={String(when.day)}
              options={Array.from({ length: 28 }, (unused, index) => ({
                value: String(index + 1),
                label: ordinal(index + 1)
              }))}
              onChange={value => onChange({ kind: 'monthly', day: Number(value), at })}
            />
          </>
        )}

        {when.kind !== 'every' && (
          <>
            <Word>at</Word>
            {time}
          </>
        )}
      </Line>

      {when.kind === 'weekly' && (
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((name, day) => (
            <Day key={name} label={name} picked={days.includes(day)} onClick={() => toggle(day)} />
          ))}
        </div>
      )}
    </div>
  )
}
