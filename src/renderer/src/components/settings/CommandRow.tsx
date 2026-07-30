import { useEffect, useState } from 'react'
import type { CommandState } from '../../../../shared/crewCommand'
import { toast } from '../../state/toast'
import { Action, Row } from './parts'

// The command comes with the app, so this row is the one press that puts it on
// PATH and the one that takes it off again. Nothing here is downloaded and
// nothing is written into a project: it is a link, and it is this machine's own.
//
// A machine with nowhere to put it answers `off`, and the row is left out
// rather than standing there greyed. That answer is the machine's own rather
// than a guess made in the renderer from what the browser calls the platform.

const LABEL: Record<Exclude<CommandState['kind'], 'off'>, string> = {
  missing: 'Install',
  linked: 'Remove',
  other: 'Replace'
}

function Mono({ children }: { children: string }) {
  return <span className="font-mono mono-inline break-all select-text">{children}</span>
}

function line(state: CommandState) {
  if (state.kind === 'linked') return <Mono>{state.where}</Mono>
  if (state.kind === 'other') return 'Something else on your machine is already called crew.'
  return (
    <>
      <Mono>crew</Mono> in a terminal opens the folder you are standing in.
    </>
  )
}

export default function CommandRow() {
  const [state, setState] = useState<CommandState | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let live = true
    void window.crew.commandState().then(next => live && setState(next))
    return () => {
      live = false
    }
  }, [])

  if (!state || state.kind === 'off') return null

  const press = async () => {
    setWorking(true)
    const done = state.kind === 'linked' ? await window.crew.removeCommand() : await window.crew.installCommand()
    // The row turning over is what says it worked, so only a failure is worth a
    // word, and a password dialog somebody dismissed is not one.
    if (done.problem) toast.fail(done.problem)
    setState(await window.crew.commandState())
    setWorking(false)
  }

  return (
    <Row label="The crew command" line={line(state)}>
      <Action label={LABEL[state.kind]} disabled={working} onClick={() => void press()} />
    </Row>
  )
}
