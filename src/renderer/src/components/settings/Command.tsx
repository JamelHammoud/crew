import { useEffect, useState } from 'react'
import type { CommandState } from '../../../../shared/crewCommand'
import { toast } from '../../state/toast'
import { Action, Page, Row, Section } from './parts'

// The command comes with the app, so this page is the one press that puts it on
// PATH and the one that takes it off again. Nothing here is downloaded and
// nothing is written into a project: it is a link, and it is this machine's own.

const LABEL: Record<CommandState['kind'], string> = {
  off: 'Install',
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

export default function Command() {
  const [state, setState] = useState<CommandState | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let live = true
    void window.crew.commandState().then(next => live && setState(next))
    return () => {
      live = false
    }
  }, [])

  if (!state) return <Page title="Command line">{null}</Page>

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
    <Page title="Command line">
      <Section>
        <Row label="The crew command" line={line(state)}>
          <Action label={LABEL[state.kind]} disabled={working} onClick={() => void press()} />
        </Row>
      </Section>
    </Page>
  )
}
