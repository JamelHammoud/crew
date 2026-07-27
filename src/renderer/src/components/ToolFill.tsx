import { useState } from 'react'
import type { CrewTool } from '../../../shared/toolbox'
import { Field, FIELD, Footer, Primary, SheetHeader } from './toolboxParts'

// A tool with a blank in it asks for the blank first, on a screen of its own
// inside the panel, the way choosing a mark is. Whatever is typed here is
// dropped into every place the tool named it.
export default function ToolFill({
  tool,
  slots,
  onBack,
  onRun
}: {
  tool: CrewTool
  slots: string[]
  onBack: () => void
  onRun: (answers: Record<string, string>) => void
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const ready = slots.every(slot => (answers[slot] ?? '').trim() !== '')

  const run = () => {
    if (ready) onRun(answers)
  }

  return (
    <>
      <SheetHeader title={tool.name} onBack={onBack} />
      <div className="p-2.5 space-y-3">
        {slots.map((slot, at) => (
          <Field key={slot} label={slot}>
            <input
              autoFocus={at === 0}
              value={answers[slot] ?? ''}
              onChange={event => setAnswers(held => ({ ...held, [slot]: event.target.value }))}
              onKeyDown={event => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                run()
              }}
              className={FIELD}
            />
          </Field>
        ))}
      </div>
      <Footer>
        <Primary label="Go" disabled={!ready} onClick={run} />
      </Footer>
    </>
  )
}
