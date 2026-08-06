import { DAY_MINUTES, EVERY_MAX, EVERY_MIN, type Cadence } from '../../../../shared/schedules'
import Select from '../Select'
import { Choice, clockOf, Field, minutesOf, PILL_INPUT } from './parts'

const KINDS: Array<{ kind: Cadence['kind']; label: string }> = [
  { kind: 'every', label: 'Every' },
  { kind: 'daily', label: 'Every day' },
  { kind: 'weekly', label: 'Certain days' },
  { kind: 'monthly', label: 'Every month' }
]

const STEPS = [15, 30, 60, 120, 180, 240, 360, 480, 720, DAY_MINUTES, DAY_MINUTES * 2, DAY_MINUTES * 3, EVERY_MAX]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const WEEKDAYS = [1, 2, 3, 4, 5]

const MORNING = 9 * 60

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

  const time = (
    <Field label="Time">
      <input
        type="time"
        value={clockOf(at)}
        aria-label="Time"
        onChange={event =>
          onChange(
            when.kind === 'weekly'
              ? { kind: 'weekly', days, at: minutesOf(event.target.value, at) }
              : when.kind === 'monthly'
                ? { kind: 'monthly', day: when.day, at: minutesOf(event.target.value, at) }
                : { kind: 'daily', at: minutesOf(event.target.value, at) }
          )
        }
        className={PILL_INPUT}
      />
    </Field>
  )

  return (
    <div className="space-y-3">
      <Field label="When">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map(one => (
            <Choice
              key={one.kind}
              label={one.label}
              picked={when.kind === one.kind}
              onClick={() => pick(one.kind)}
            />
          ))}
        </div>
      </Field>

      {when.kind === 'every' && (
        <Field label="How often">
          <Select
            value={String(when.minutes)}
            options={STEPS.map(minutes => ({ value: String(minutes), label: amount(minutes) }))}
            onChange={value => onChange({ kind: 'every', minutes: Number(value) })}
          />
        </Field>
      )}

      {when.kind === 'weekly' && (
        <Field label="Which days">
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((name, day) => (
              <Choice key={name} label={name} picked={days.includes(day)} onClick={() => toggle(day)} />
            ))}
          </div>
        </Field>
      )}

      {when.kind === 'monthly' && (
        <Field label="Day of the month">
          <Select
            value={String(when.day)}
            options={Array.from({ length: 28 }, (unused, index) => ({
              value: String(index + 1),
              label: String(index + 1)
            }))}
            onChange={value => onChange({ kind: 'monthly', day: Number(value), at })}
          />
        </Field>
      )}

      {when.kind !== 'every' && time}
    </div>
  )
}
