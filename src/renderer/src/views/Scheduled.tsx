import { useState } from 'react'
import { sayCadence, type Schedule } from '../../../shared/schedules'
import ScheduleCard from '../components/scheduled/ScheduleCard'
import ScheduleRow from '../components/scheduled/ScheduleRow'
import { PlusGlyph, SearchGlyph } from '../icons'
import { useCrew } from '../state/store'

const matches = (find: string, ...words: string[]): boolean =>
  !find || words.some(word => word.toLowerCase().includes(find.toLowerCase().trim()))

export default function Scheduled() {
  const schedules = useCrew(s => s.schedules)
  const removeSchedule = useCrew(s => s.removeSchedule)
  const pauseSchedule = useCrew(s => s.pauseSchedule)
  const runSchedule = useCrew(s => s.runSchedule)
  const [find, setFind] = useState('')
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [open, setOpen] = useState(false)

  const shown = schedules.filter(one => matches(find, one.name, sayCadence(one.when)))
  const running = shown.filter(one => !one.paused)
  const paused = shown.filter(one => one.paused)

  const edit = (schedule: Schedule) => {
    setEditing(schedule)
    setOpen(true)
  }

  const rows = (list: Schedule[]) =>
    list.map(one => (
      <ScheduleRow
        key={one.id}
        schedule={one}
        onPause={() => pauseSchedule(one.id, !one.paused)}
        onRun={() => runSchedule(one.id)}
        onEdit={() => edit(one)}
        onRemove={() => removeSchedule(one.id)}
      />
    ))

  return (
    <div className="h-full overflow-y-auto px-6">
      <div className="max-w-[720px] mx-auto pt-24 pb-24">
        <div className="flex items-end justify-between gap-6">
          <h1 className="text-2xl font-semibold text-fg">Scheduled</h1>
          <div className="relative shrink-0">
            <SearchGlyph className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none" />
            <input
              value={find}
              onChange={event => setFind(event.target.value)}
              placeholder="Search"
              aria-label="Search schedules"
              spellCheck={false}
              className="w-56 h-10 pl-10 pr-4 rounded-full bg-ink-800 text-sm text-fg placeholder:text-fg-muted outline-none transition-shadow duration-200 focus:shadow-[0_0_0_1px_rgb(255_255_255/0.12)] light:focus:shadow-[0_0_0_1px_rgb(0_0_0/0.14)]"
            />
          </div>
        </div>

        {running.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold text-fg-muted mb-1.5">Running</h2>
            <div className="space-y-0.5">{rows(running)}</div>
          </section>
        )}

        {paused.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold text-fg-muted mb-1.5">Paused</h2>
            <div className="space-y-0.5">{rows(paused)}</div>
          </section>
        )}

        <div className="mt-10">
          <button
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
            className="group w-full flex items-center gap-3 px-5 py-4 rounded-card border border-fg/[0.09] text-left transition-colors duration-200 hover:border-fg/20 hover:bg-fg/[0.03] active:scale-[0.995]"
          >
            <span className="w-10 h-10 rounded-full bg-fg/[0.07] flex items-center justify-center text-fg/70 transition-colors duration-200 group-hover:bg-fg/[0.12] group-hover:text-fg">
              <PlusGlyph className="w-[18px] h-[18px]" />
            </span>
            <span className="text-base font-semibold text-fg">Schedule something</span>
          </button>
        </div>
      </div>
      <ScheduleCard open={open} schedule={editing} onClose={() => setOpen(false)} />
    </div>
  )
}
