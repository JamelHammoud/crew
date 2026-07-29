import { useMemo } from 'react'
import { LineText, useHighlight } from './codeLine'
import CopyButton from './CopyButton'
import { plainRows } from './diffRows'

const SHOWN = 20

// What the command printed, under the command itself and on the same surface,
// the way a terminal reads. It is the one thing here that can run to any
// length, so it keeps a height of its own and scrolls inside it.
function Output({ text }: { text: string }) {
  return (
    <div className="relative border-t border-ink-700">
      <div className="select-text max-h-60 overflow-auto py-2 font-mono text-xs leading-5">
        <div className="w-max min-w-full whitespace-pre pl-3 pr-10 text-fg-muted">{text}</div>
      </div>
      <CopyButton text={text} label="Copy output" className="absolute top-1 right-1" />
    </div>
  )
}

export default function StepCode({ text, prompt, output }: { text: string; prompt?: boolean; output?: string }) {
  const rows = useMemo(() => plainRows(text), [text])
  const tokensFor = useHighlight(prompt ? 'command.sh' : 'notes.txt', rows)
  const shown = rows.slice(0, SHOWN)
  const rest = rows.length - shown.length

  return (
    <div className="relative overflow-hidden rounded-xl border border-ink-700 bg-ink-850">
      <div className="select-text overflow-x-auto py-2 font-mono text-xs leading-5">
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
            <p className="px-3 pt-1 text-fg-faint select-none">{`${rest} more ${rest === 1 ? 'line' : 'lines'}`}</p>
          )}
        </div>
      </div>
      <CopyButton
        text={text}
        label={output ? 'Copy command' : undefined}
        className="absolute top-1 right-1"
      />
      {output && <Output text={output} />}
    </div>
  )
}
