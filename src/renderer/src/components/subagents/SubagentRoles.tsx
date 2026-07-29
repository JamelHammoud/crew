import { useState } from 'react'
import type { Subagent } from '../../../../shared/subagents'
import { PencilGlyph, PlusGlyph } from '../../icons'
import { useCrew } from '../../state/store'
import SubagentMark from '../SubagentMark'
import { AREA, Footer, HeaderButton, Primary, SheetHeader } from '../toolboxParts'

// The roles the crew has written, and the one thing you can do with one from
// here: send it out on the thread you came from. Writing a new one is the plus
// on the bar, and the empty state says what a helper is rather than naming the
// screen back at you.

export function SubagentRoster({
  onPick,
  onNew,
  onEdit,
  onBack
}: {
  onPick: (role: Subagent) => void
  onNew: () => void
  onEdit: (role: Subagent) => void
  onBack: () => void
}) {
  const roles = useCrew(state => state.subagents)

  return (
    <div className="flex flex-col h-full">
      <SheetHeader title="Helpers" onBack={onBack}>
        <HeaderButton label="New helper" onClick={onNew}>
          <PlusGlyph className="w-4 h-4" />
        </HeaderButton>
      </SheetHeader>
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {roles.length === 0 ? (
          <div className="px-6 py-10">
            <p className="text-sm text-fg/45 text-center">
              A helper is one piece of work handed to an agent of its own. Write one and anybody here can send it out.
            </p>
          </div>
        ) : (
          roles.map(role => (
            <div key={role.id} className="group flex items-center gap-1 pr-1.5">
              <button
                type="button"
                onClick={() => onPick(role)}
                className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-fg/[0.04]"
              >
                <SubagentMark seed={role.id} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm text-fg truncate">{role.name}</span>
                  <span className="block text-xs text-fg/45 truncate">{role.brief.split('\n')[0]}</span>
                </span>
              </button>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                <HeaderButton label="Edit" onClick={() => onEdit(role)}>
                  <PencilGlyph className="w-4 h-4" />
                </HeaderButton>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function SubagentBrief({
  role,
  threadId,
  onDone
}: {
  role: Subagent
  threadId: string
  onDone: () => void
}) {
  const runSubagent = useCrew(state => state.runSubagent)
  const [task, setTask] = useState('')

  const send = () => {
    runSubagent(role.id, threadId, task.split('\n')[0], task)
    onDone()
  }

  return (
    <div className="flex flex-col h-full">
      <SheetHeader title={role.name} onBack={onDone} />
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        <textarea
          autoFocus
          value={task}
          rows={8}
          onChange={event => setTask(event.target.value)}
          placeholder="What it should do. It cannot see this thread, so write the whole of it."
          className={AREA}
        />
      </div>
      <Footer>
        <Primary label="Send it out" disabled={!task.trim()} onClick={send} />
      </Footer>
    </div>
  )
}
