// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, it } from 'vitest'
import DiffLines from '../src/renderer/src/components/DiffLines'
import Markdown from '../src/renderer/src/components/Markdown'
import StepCode from '../src/renderer/src/components/StepCode'
import { diffRows } from '../src/renderer/src/components/diffRows'
import { highlightLines } from '../src/renderer/src/components/highlight'

if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []

afterEach(cleanup)

const ROWS = 3832

const PARA = [
  'The parser reads the whole of the file before it says anything at all about what is in there,',
  'and `src/server/session.ts` is where it lands. See https://example.com/docs for the rest of it.',
  '',
  '- one thing it does',
  '- another thing it does',
  '',
  'That is the whole of it 🎉 and nothing more.'
].join('\n')

const FENCE = [
  'Here is what changed:',
  '',
  '```ts',
  ...Array.from({ length: 40 }, (_, i) => `export function thing${i}(value: string): number {`),
  '```',
  '',
  'and that is it.'
].join('\n')

const SOURCE = Array.from(
  { length: 200 },
  (_, i) => `  const value${i} = compute(${i}, 'name${i}') // a line of a real file`
).join('\n')

const CHANGED = SOURCE.split('\n')
  .map((line, i) => (i % 7 === 3 ? line.replace('compute', 'reckon') : line))
  .join('\n')

const OUTPUT = Array.from({ length: 500 }, (_, i) => `  at Object.<anonymous> (/Users/x/file${i}.ts:${i}:12)`).join(
  '\n'
)

const COMMAND = 'yarn test tests/thread-render-probe.test.ts --reporter dot'

function time(label: string, runs: number, work: () => void): void {
  work()
  cleanup()
  const at = performance.now()
  for (let i = 0; i < runs; i += 1) {
    work()
    cleanup()
  }
  const each = (performance.now() - at) / runs
  console.log(`${label.padEnd(28)} ${each.toFixed(3)} ms each   ${((each * ROWS) / 1000).toFixed(2)} s for ${ROWS}`)
}

describe('what a row costs to draw', () => {
  it('times the four shapes', async () => {
    await highlightLines('a.ts', 'const x = 1', 'dark')

    time('markdown paragraph', 60, () => {
      render(createElement(Markdown, { text: PARA }))
    })
    time('markdown with a fence', 60, () => {
      render(createElement(Markdown, { text: FENCE }))
    })

    const rows = diffRows(SOURCE, CHANGED).slice(0, 30)
    time('step diff, 30 of 200 rows', 40, () => {
      render(createElement(DiffLines, { path: 'thing.ts', rows }))
    })

    time('terminal card, 500 out', 40, () => {
      render(createElement(StepCode, { text: COMMAND, prompt: true, output: OUTPUT }))
    })
  })

  it('times shiki on its own', async () => {
    const at = performance.now()
    await highlightLines('thing.ts', SOURCE, 'dark')
    console.log(`shiki first 200 lines      ${(performance.now() - at).toFixed(2)} ms`)

    const again = performance.now()
    for (let i = 0; i < 20; i += 1) await highlightLines('thing.ts', SOURCE, 'dark')
    console.log(`shiki same 200 lines       ${((performance.now() - again) / 20).toFixed(2)} ms each`)

    const short = diffRows(SOURCE, CHANGED).slice(0, 30)
    const text = short.map(row => row.text).join('\n')
    const thirty = performance.now()
    for (let i = 0; i < 40; i += 1) await highlightLines('thing.ts', text, 'dark')
    console.log(`shiki 30 lines             ${((performance.now() - thirty) / 40).toFixed(2)} ms each`)

    const cmd = performance.now()
    for (let i = 0; i < 100; i += 1) await highlightLines('command.sh', COMMAND, 'dark')
    console.log(`shiki one command line     ${((performance.now() - cmd) / 100).toFixed(2)} ms each`)
  })
})
