import { useMemo } from 'react'
import { LineText, useHighlight } from './codeLine'
import CopyButton from './CopyButton'
import { plainRows } from './diffRows'

const SHOWN = 20

export default function StepCode({ text, prompt }: { text: string; prompt?: boolean }) {
  const rows = useMemo(() => plainRows(text), [text])
  const tokensFor = useHighlight(prompt ? 'command.sh' : 'notes.txt', rows)
  const shown = rows.slice(0, SHOWN)
  const rest = rows.length - shown.length

  return (
    <div className="relative rounded-xl border border-ink-700 bg-ink-850">
      <div className="overflow-x-auto py-2 font-mono text-xs leading-5">
        <div className="w-max min-w-full">
          {shown.map((row, index) => (
            <div key={index} className="flex px-3">
              {prompt && (
                <span className="shrink-0 w-4 select-none text-fg-faint">{index === 0 ? '$' : ''}</span>
              )}
              <span className="whitespace-pre text-fg-secondary pr-10">
                <LineText row={row} tokens={tokensFor(row)} tint="" />
              </span>
            </div>
          ))}
          {rest > 0 && (
            <p className="px-3 pt-1 text-fg-faint">{`${rest} more ${rest === 1 ? 'line' : 'lines'}`}</p>
          )}
        </div>
      </div>
      <CopyButton text={text} className="absolute top-1 right-1" />
    </div>
  )
}
