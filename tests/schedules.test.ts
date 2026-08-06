import { describe, expect, it } from 'vitest'
import {
  cleanCadence,
  cleanSchedule,
  cleanZone,
  DAY_MINUTES,
  due,
  EVERY_MIN,
  instantOf,
  nextRun,
  sayCadence,
  schedulable,
  wallIn,
  type Schedule
} from '../src/shared/schedules'

const LISBON = 'Europe/Lisbon'
const NEW_YORK = 'America/New_York'

const made = (over: Partial<Schedule> = {}): Schedule => ({
  id: 'one',
  name: 'Standup',
  mark: 'clock',
  when: { kind: 'daily', at: 9 * 60 },
  action: { kind: 'say', text: 'Morning' },
  zone: LISBON,
  createdBy: 'Jamel',
  ts: Date.UTC(2026, 0, 1, 0, 0),
  ...over
})

describe('what a schedule may be', () => {
  it('takes the actions that are the crew\'s own', () => {
    expect(schedulable({ kind: 'say', text: 'hi' })).toBe(true)
    expect(schedulable({ kind: 'prompt', text: 'review the diff' })).toBe(true)
    expect(schedulable({ kind: 'todo', text: 'water the plants' })).toBe(true)
    expect(schedulable({ kind: 'chain', toolIds: ['a'] })).toBe(true)
  })

  it('refuses the ones that need somebody at a screen', () => {
    expect(schedulable({ kind: 'terminal', command: 'ls' })).toBe(false)
    expect(schedulable({ kind: 'web', url: 'https://example.com' })).toBe(false)
    expect(schedulable({ kind: 'file', path: '/tmp/one' })).toBe(false)
    expect(cleanSchedule('Build', 'star', { kind: 'daily', at: 60 }, { kind: 'terminal', command: 'yarn build' }, LISBON)).toBeNull()
  })

  it('is nothing without a name, an action or a cadence', () => {
    const when = { kind: 'daily', at: 60 }
    expect(cleanSchedule('', 'star', when, { kind: 'say', text: 'hi' }, LISBON)).toBeNull()
    expect(cleanSchedule('One', 'star', when, { kind: 'say', text: '   ' }, LISBON)).toBeNull()
    expect(cleanSchedule('One', 'star', { kind: 'never' }, { kind: 'say', text: 'hi' }, LISBON)).toBeNull()
  })

  it('holds a cadence to what can really be asked for', () => {
    expect(cleanCadence({ kind: 'every', minutes: 1 })).toBeNull()
    expect(cleanCadence({ kind: 'every', minutes: EVERY_MIN })).toEqual({ kind: 'every', minutes: EVERY_MIN })
    expect(cleanCadence({ kind: 'daily', at: DAY_MINUTES })).toBeNull()
    expect(cleanCadence({ kind: 'weekly', days: [], at: 60 })).toBeNull()
    expect(cleanCadence({ kind: 'weekly', days: [3, 1, 1, 9], at: 60 })).toEqual({ kind: 'weekly', days: [1, 3], at: 60 })
    expect(cleanCadence({ kind: 'monthly', day: 31, at: 60 })).toBeNull()
  })

  it('falls back to this machine\'s zone rather than throwing on a bad one', () => {
    expect(cleanZone('Mars/Olympus')).toBe(cleanZone(''))
    expect(cleanZone(LISBON)).toBe(LISBON)
  })
})

describe('when it next runs', () => {
  it('lands on the wall clock it was written for', () => {
    const at = nextRun(made(), Date.UTC(2026, 5, 10, 0, 0))
    expect(wallIn(at, LISBON).hh).toBe(9)
    expect(wallIn(at, LISBON).mm).toBe(0)
  })

  it('is the same wall clock in every zone the crew reads it from', () => {
    const at = nextRun(made({ zone: NEW_YORK }), Date.UTC(2026, 5, 10, 0, 0))
    expect(wallIn(at, NEW_YORK).hh).toBe(9)
  })

  it('is strictly after the moment it was asked from', () => {
    const nine = instantOf(2026, 6, 10, 9 * 60, LISBON)
    expect(nextRun(made(), nine)).toBeGreaterThan(nine)
    expect(wallIn(nextRun(made(), nine), LISBON).d).toBe(11)
  })

  it('holds the wall clock across the day the clocks go forward', () => {
    const before = instantOf(2026, 3, 28, 9 * 60, NEW_YORK)
    const after = nextRun(made({ zone: NEW_YORK }), before)
    expect(wallIn(after, NEW_YORK).hh).toBe(9)
    expect(wallIn(after, NEW_YORK).mm).toBe(0)
  })

  it('holds it across the day they go back', () => {
    const before = instantOf(2026, 10, 31, 9 * 60, NEW_YORK)
    const after = nextRun(made({ zone: NEW_YORK }), before)
    expect(wallIn(after, NEW_YORK).hh).toBe(9)
  })

  it('only walks the days it was asked for', () => {
    const weekly = made({ when: { kind: 'weekly', days: [1], at: 9 * 60 } })
    const at = nextRun(weekly, Date.UTC(2026, 5, 10, 0, 0))
    expect(wallIn(at, LISBON).weekday).toBe(1)
  })

  it('walks a month rather than adding thirty days', () => {
    const monthly = made({ when: { kind: 'monthly', day: 1, at: 9 * 60 } })
    const at = nextRun(monthly, instantOf(2026, 1, 15, 0, LISBON))
    expect(wallIn(at, LISBON).d).toBe(1)
    expect(wallIn(at, LISBON).m).toBe(2)
  })

  it('counts an interval off the last run rather than off the hour', () => {
    const every = made({ when: { kind: 'every', minutes: 30 }, lastRunAt: Date.UTC(2026, 5, 10, 9, 10) })
    expect(nextRun(every, Date.UTC(2026, 5, 10, 9, 20))).toBe(Date.UTC(2026, 5, 10, 9, 40))
  })
})

describe('what a missed run costs', () => {
  it('is due once the moment has passed', () => {
    const one = made({ lastRunAt: instantOf(2026, 5, 10, 9 * 60, LISBON) })
    expect(due(one, instantOf(2026, 5, 11, 8 * 60, LISBON))).toBe(false)
    expect(due(one, instantOf(2026, 5, 11, 9 * 60, LISBON))).toBe(true)
  })

  it('fires once after a week asleep rather than catching up', () => {
    const woke = instantOf(2026, 5, 18, 10 * 60, LISBON)
    const one = made({ lastRunAt: instantOf(2026, 5, 10, 9 * 60, LISBON) })
    expect(due(one, woke)).toBe(true)
    const ran = { ...one, lastRunAt: woke }
    expect(due(ran, woke + 1000)).toBe(false)
  })

  it('never fires while it is paused', () => {
    const one = made({ paused: true, lastRunAt: instantOf(2026, 5, 10, 9 * 60, LISBON) })
    expect(due(one, instantOf(2026, 5, 20, 9 * 60, LISBON))).toBe(false)
  })
})

describe('what the row says about when it runs', () => {
  it('says a cadence in words rather than in a cron line', () => {
    expect(sayCadence({ kind: 'daily', at: 9 * 60 })).toBe('Every day at 09:00')
    expect(sayCadence({ kind: 'every', minutes: 30 })).toBe('Every 30 minutes')
    expect(sayCadence({ kind: 'every', minutes: 60 })).toBe('Every hour')
    expect(sayCadence({ kind: 'every', minutes: 120 })).toBe('Every 2 hours')
    expect(sayCadence({ kind: 'every', minutes: DAY_MINUTES })).toBe('Every day')
    expect(sayCadence({ kind: 'monthly', day: 1, at: 9 * 60 })).toBe('The 1st of the month at 09:00')
    expect(sayCadence({ kind: 'monthly', day: 22, at: 30 })).toBe('The 22nd of the month at 00:30')
  })

  it('names the shapes of a week people really mean', () => {
    expect(sayCadence({ kind: 'weekly', days: [1, 2, 3, 4, 5], at: 9 * 60 })).toBe('Weekdays at 09:00')
    expect(sayCadence({ kind: 'weekly', days: [0, 6], at: 9 * 60 })).toBe('Weekends at 09:00')
    expect(sayCadence({ kind: 'weekly', days: [0, 1, 2, 3, 4, 5, 6], at: 9 * 60 })).toBe('Every day at 09:00')
    expect(sayCadence({ kind: 'weekly', days: [1], at: 9 * 60 })).toBe('Every Monday at 09:00')
    expect(sayCadence({ kind: 'weekly', days: [1, 4], at: 17 * 60 })).toBe('Every Monday and Thursday at 17:00')
  })
})
