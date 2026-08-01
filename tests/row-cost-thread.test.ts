// @vitest-environment jsdom
import { describe, it } from 'vitest'
import { highlightLines } from '../src/renderer/src/components/highlight'

const FILES = ['session.ts', 'store.ts', 'thread.ts', 'highlight.ts', 'Markdown.tsx', 'git.ts']

const COMMANDS = [
  'yarn tsc --noEmit',
  'yarn test tests/thread-render-probe.test.ts',
  'git status --porcelain',
  'rg "useHighlight" src',
  'yarn test tests/markdown-stream-probe.test.ts'
]

function chunk(file: string, at: number): string {
  return Array.from(
    { length: 30 },
    (_, i) => `  const value${at + i} = compute(${i}, '${file}') // a line of a real file`
  ).join('\n')
}

describe('what a thread of cards costs to highlight', () => {
  it('walks the cards a big thread really holds', async () => {
    await highlightLines('a.ts', 'const x = 1', 'dark')

    const cards: Array<[string, string]> = []
    for (let i = 0; i < 300; i += 1) {
      const file = FILES[i % FILES.length]
      cards.push([file, chunk(file, (i % 12) * 30)])
    }
    for (let i = 0; i < 500; i += 1) cards.push(['command.sh', COMMANDS[i % COMMANDS.length]])

    const at = performance.now()
    for (const [path, text] of cards) await highlightLines(path, text, 'dark')
    const took = performance.now() - at
    console.log(`${cards.length} cards highlighted   ${took.toFixed(0)} ms total`)

    const again = performance.now()
    for (const [path, text] of cards) await highlightLines(path, text, 'dark')
    console.log(`the same cards again      ${(performance.now() - again).toFixed(0)} ms total`)
  })
})
