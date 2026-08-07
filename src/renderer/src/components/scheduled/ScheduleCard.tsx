import { useCallback, useEffect, useRef, useState } from 'react'
import type { Cadence, Schedule } from '../../../../shared/schedules'
import { DEFAULT_MARK, NAME_LIMIT, type ToolAction } from '../../../../shared/toolbox'
import { useCrew } from '../../state/store'
import Modal from '../Modal'
import TextField from '../TextField'
import ToolMarkView from '../toolMark'
import type { ToolKind } from '../toolKinds'
import ScheduleDoes from './ScheduleDoes'
import ScheduleWhen from './ScheduleWhen'
import { MORNING, Rule } from './parts'

const MARKS: Record<string, string> = {
  prompt: 'spark',
  post: 'send',
  say: 'chat',
  todo: 'checklist',
  note: 'pencil',
  music: 'music',
  chain: 'group'
}

export default function ScheduleCard({
  open,
  schedule,
  onClose
}: {
  open: boolean
  schedule: Schedule | null
  onClose: () => void
}) {
  const addSchedule = useCrew(s => s.addSchedule)
  const editSchedule = useCrew(s => s.editSchedule)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ToolKind>('prompt')
  const [action, setAction] = useState<ToolAction | null>(null)
  const [when, setWhen] = useState<Cadence>({ kind: 'daily', at: MORNING })
  const [trouble, setTrouble] = useState('')
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(schedule?.name ?? '')
    setKind(schedule?.action.kind ?? 'prompt')
    setAction(schedule?.action ?? null)
    setWhen(schedule?.when ?? { kind: 'daily', at: MORNING })
    setTrouble('')
    first.current?.focus()
  }, [open, schedule])

  const took = useCallback((next: ToolAction | null) => setAction(next), [])

  const mark = MARKS[kind] ?? DEFAULT_MARK
  const ready = name.trim() !== '' && action !== null

  const send = () => {
    if (!action || !name.trim()) return
    const said = schedule
      ? editSchedule(schedule.id, name, mark, when, action)
      : addSchedule(name, mark, when, action)
    if (said) setTrouble(said)
    else onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={schedule ? 'Edit schedule' : 'New schedule'} width={520}>
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 shrink-0 rounded-full bg-fg/[0.07] flex items-center justify-center text-fg/70">
            <ToolMarkView mark={mark} className="w-[18px] h-[18px]" />
          </span>
          <TextField
            glass
            ref={first}
            value={name}
            maxLength={NAME_LIMIT}
            placeholder="Morning standup"
            aria-label="Name"
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              send()
            }}
          />
        </div>

        <Rule />
        <ScheduleDoes kind={kind} onKind={setKind} initial={schedule?.action ?? null} onChange={took} />
        <Rule />
        <ScheduleWhen when={when} onChange={setWhen} />
      </div>
      {trouble && <p className="mt-3 text-sm text-danger">{trouble}</p>}
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="h-10 px-4 rounded-full text-sm font-semibold text-fg/45 transition-colors hover:text-fg"
        >
          Cancel
        </button>
        <button
          onClick={send}
          disabled={!ready}
          className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:bg-fg/10 disabled:text-fg/45"
        >
          {schedule ? 'Save' : 'Add'}
        </button>
      </div>
    </Modal>
  )
}
