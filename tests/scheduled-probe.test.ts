// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Cadence, Schedule } from '../src/shared/schedules'
import type { ToolAction } from '../src/shared/toolbox'

Element.prototype.getAnimations ??= () => []

const kept = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => kept.set(key, value),
    removeItem: (key: string) => kept.delete(key),
    clear: () => kept.clear()
  }
})

class NoResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = NoResizeObserver as unknown as typeof ResizeObserver

class NoSocket {
  static OPEN = 1
  readyState = 0
  close(): void {}
  send(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
}
globalThis.WebSocket = NoSocket as unknown as typeof WebSocket

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia

const { SCHEDULABLE, sayCadence } = await import('../src/shared/schedules')
const { TOOL_KINDS } = await import('../src/renderer/src/components/toolKinds')
const { useCrew } = await import('../src/renderer/src/state/store')
const ScheduledView = (await import('../src/renderer/src/views/Scheduled')).default

const one = (
  id: string,
  name: string,
  when: Cadence,
  extra: Partial<Schedule> = {}
): Schedule => ({
  id,
  name,
  mark: 'spark',
  when,
  action: { kind: 'say', text: 'Standup in ten minutes' },
  zone: 'UTC',
  createdBy: 'Jamel',
  ts: 1,
  ...extra
})

const MORNING: Cadence = { kind: 'daily', at: 9 * 60 }

const scheduled = () => render(createElement(ScheduledView))

const rowFor = (name: string): HTMLElement => screen.getByText(name).closest('div.group') as HTMLElement

describe('the scheduled page', () => {
  beforeEach(() => {
    useCrew.setState({
      schedules: [],
      tools: [],
      docs: {},
      addSchedule: () => null,
      editSchedule: () => null,
      removeSchedule: () => {},
      pauseSchedule: () => {},
      runSchedule: () => {}
    })
  })

  afterEach(cleanup)

  it('ends the list on the way to one, with nothing scheduled yet', () => {
    scheduled()
    expect(screen.queryByText('Running')).toBeNull()
    expect(screen.queryByText('Paused')).toBeNull()
    expect(screen.getByRole('button', { name: /Schedule something/ })).toBeTruthy()
  })

  it('stands the ones that are running apart from the ones that are paused', () => {
    useCrew.setState({
      schedules: [one('a', 'Morning sweep', MORNING), one('b', 'Nightly tidy', MORNING, { paused: true })]
    })
    scheduled()
    expect(screen.getByText('Running')).toBeTruthy()
    expect(screen.getByText('Paused')).toBeTruthy()
    expect(rowFor('Morning sweep')).toBeTruthy()
    expect(rowFor('Nightly tidy')).toBeTruthy()
  })

  it('leaves a section out when nothing is in it', () => {
    useCrew.setState({ schedules: [one('a', 'Morning sweep', MORNING)] })
    scheduled()
    expect(screen.getByText('Running')).toBeTruthy()
    expect(screen.queryByText('Paused')).toBeNull()
  })

  it('says when it runs under the name', () => {
    useCrew.setState({ schedules: [one('a', 'Morning sweep', MORNING)] })
    scheduled()
    expect(rowFor('Morning sweep').textContent).toContain(sayCadence(MORNING))
  })

  it('says when it last ran where it ever has', () => {
    useCrew.setState({
      schedules: [one('a', 'Morning sweep', MORNING, { lastRunAt: Date.now() - 2 * 60 * 60 * 1000 })]
    })
    scheduled()
    expect(rowFor('Morning sweep').textContent).toContain('Last ran 2h ago')
  })

  it('pauses one and starts it again', () => {
    const asked: Array<[string, boolean]> = []
    useCrew.setState({
      schedules: [one('a', 'Morning sweep', MORNING), one('b', 'Nightly tidy', MORNING, { paused: true })],
      pauseSchedule: (scheduleId, paused) => asked.push([scheduleId, paused])
    })
    scheduled()
    fireEvent.click(screen.getByRole('button', { name: 'Pause Morning sweep' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start Nightly tidy again' }))
    expect(asked).toEqual([
      ['a', true],
      ['b', false]
    ])
  })

  it('runs one now', () => {
    const asked: string[] = []
    useCrew.setState({
      schedules: [one('a', 'Morning sweep', MORNING)],
      runSchedule: scheduleId => asked.push(scheduleId)
    })
    scheduled()
    fireEvent.click(screen.getByRole('button', { name: 'Run Morning sweep now' }))
    expect(asked).toEqual(['a'])
  })

  it('takes one out', () => {
    const gone: string[] = []
    useCrew.setState({
      schedules: [one('a', 'Morning sweep', MORNING)],
      removeSchedule: scheduleId => gone.push(scheduleId)
    })
    scheduled()
    fireEvent.click(screen.getByRole('button', { name: 'Take Morning sweep out' }))
    expect(gone).toEqual(['a'])
  })

  it('searches by name and by when it runs', () => {
    useCrew.setState({
      schedules: [one('a', 'Morning sweep', MORNING), one('b', 'Nightly tidy', { kind: 'every', minutes: 60 })]
    })
    scheduled()
    fireEvent.change(screen.getByLabelText('Search schedules'), { target: { value: 'every hour' } })
    expect(screen.getByText('Nightly tidy')).toBeTruthy()
    expect(screen.queryByText('Morning sweep')).toBeNull()
  })
})

describe('the card one is written on', () => {
  beforeEach(() => {
    useCrew.setState({
      schedules: [],
      tools: [],
      docs: {},
      addSchedule: () => null,
      editSchedule: () => null,
      removeSchedule: () => {},
      pauseSchedule: () => {},
      runSchedule: () => {}
    })
  })

  afterEach(cleanup)

  const openCard = () => {
    scheduled()
    fireEvent.click(screen.getByRole('button', { name: /Schedule something/ }))
  }

  const open = (control: string) => fireEvent.click(screen.getByRole('button', { name: control }))

  const pick = (control: string, option: string | RegExp) => {
    open(control)
    fireEvent.click(screen.getByRole('button', { name: option }))
  }

  it('offers only the kinds that can be put on a clock', () => {
    openCard()
    open('What it does')
    for (const entry of TOOL_KINDS) {
      const offered = (SCHEDULABLE as readonly string[]).includes(entry.kind)
      expect(screen.queryAllByText(entry.title).length > 0, entry.kind).toBe(offered)
    }
  })

  it('asks when it runs in plain words rather than as a cron line', () => {
    openCard()
    open('How often it runs')
    for (const words of ['Every', 'Every day', 'Certain days', 'Every month']) {
      expect(screen.queryAllByText(words).length > 0, words).toBe(true)
    }
  })

  it('holds the way in shut until it has a name and something to do', () => {
    openCard()
    const add = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morning sweep' } })
    expect(add.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('What to ask'), { target: { value: 'Read what came in' } })
    expect(add.disabled).toBe(false)
  })

  it('writes one down with what it does and when', () => {
    const asked: Array<[string, string, Cadence, ToolAction]> = []
    useCrew.setState({
      addSchedule: (name, mark, when, action) => (asked.push([name, mark, when, action]), null)
    })
    openCard()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morning sweep' } })
    fireEvent.change(screen.getByLabelText('What to ask'), { target: { value: 'Read what came in' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '07:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(asked).toEqual([
      ['Morning sweep', 'spark', { kind: 'daily', at: 450 }, { kind: 'prompt', text: 'Read what came in' }]
    ])
  })

  it('names the agent an ask goes to, and offers anyone as well', () => {
    const asked: ToolAction[] = []
    useCrew.setState({
      agents: [{ id: 'bee', label: 'Bubbles', status: 'idle' }] as never,
      addSchedule: (_name, _mark, _when, action) => (asked.push(action), null)
    })
    openCard()
    open('Ask who')
    expect(screen.getByRole('button', { name: 'Anyone' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morning sweep' } })
    fireEvent.change(screen.getByLabelText('What to ask'), { target: { value: 'Read what came in' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bubbles' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(asked).toEqual([{ kind: 'prompt', text: 'Read what came in', agentId: 'bee' }])
  })

  it('leaves an ask to whoever is here when nobody is named', () => {
    const asked: ToolAction[] = []
    useCrew.setState({
      agents: [{ id: 'bee', label: 'Bubbles', status: 'idle' }] as never,
      addSchedule: (_name, _mark, _when, action) => (asked.push(action), null)
    })
    openCard()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morning sweep' } })
    fireEvent.change(screen.getByLabelText('What to ask'), { target: { value: 'Read what came in' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(asked).toEqual([{ kind: 'prompt', text: 'Read what came in' }])
  })

  it('opens on the agent a schedule already names', () => {
    useCrew.setState({
      agents: [{ id: 'bee', label: 'Bubbles', status: 'idle' }] as never,
      schedules: [
        one('a', 'Nightly tidy', MORNING, { action: { kind: 'prompt', text: 'Tidy up', agentId: 'bee' } })
      ]
    })
    scheduled()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Nightly tidy' }))
    expect(screen.getByRole('button', { name: 'Ask who' }).textContent).toContain('Bubbles')
  })

  it('swaps the one field for the one the kind needs', () => {
    openCard()
    expect(screen.getByLabelText('What to ask')).toBeTruthy()
    pick('What it does', /^Say something/)
    expect(screen.queryByLabelText('What to ask')).toBeNull()
    expect(screen.getByLabelText('What to say')).toBeTruthy()
  })

  it('swaps the one control for the one the cadence needs', () => {
    openCard()
    expect(screen.getByLabelText('Time')).toBeTruthy()
    pick('How often it runs', 'Every')
    expect(screen.queryByLabelText('Time')).toBeNull()
    pick('How often it runs', 'Certain days')
    expect(screen.getByRole('button', { name: 'Mon' })).toBeTruthy()
    expect(screen.getByLabelText('Time')).toBeTruthy()
  })

  it('never lets a week end up with no day in it', () => {
    const asked: Cadence[] = []
    useCrew.setState({ addSchedule: (name, mark, when) => (asked.push(when), null) })
    openCard()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Weekly sweep' } })
    fireEvent.change(screen.getByLabelText('What to ask'), { target: { value: 'Read what came in' } })
    pick('How often it runs', 'Certain days')
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      fireEvent.click(screen.getByRole('button', { name: day }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(asked[0]).toEqual({ kind: 'weekly', days: [5], at: 9 * 60 })
  })

  it('says a refusal on the card and stays open', () => {
    useCrew.setState({ addSchedule: () => 'Say when it runs' })
    openCard()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morning sweep' } })
    fireEvent.change(screen.getByLabelText('What to ask'), { target: { value: 'Read what came in' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Say when it runs')).toBeTruthy()
    expect(screen.getByLabelText('Name')).toBeTruthy()
  })

  it('opens on what a row already says when it is edited', () => {
    useCrew.setState({
      schedules: [
        one('a', 'Nightly tidy', { kind: 'every', minutes: 120 }, {
          action: { kind: 'say', text: 'Wrapping up' }
        })
      ]
    })
    scheduled()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Nightly tidy' }))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Nightly tidy')
    expect((screen.getByLabelText('What to say') as HTMLTextAreaElement).value).toBe('Wrapping up')
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('saves an edit against the row it was opened on', () => {
    const asked: string[] = []
    useCrew.setState({
      schedules: [one('a', 'Nightly tidy', MORNING, { action: { kind: 'say', text: 'Wrapping up' } })],
      editSchedule: scheduleId => (asked.push(scheduleId), null)
    })
    scheduled()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Nightly tidy' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(asked).toEqual(['a'])
  })
})
