// @vitest-environment jsdom
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { describe, it } from 'vitest'
import { emojifyHtml } from '../src/renderer/src/components/emojiHtml'
import { linkifyFiles } from '../src/renderer/src/components/fileLinks'

const PARA = [
  'The parser reads the whole of the file before it says anything at all about what is in there,',
  'and `src/server/session.ts` is where it lands. See https://example.com/docs for the rest of it.',
  '',
  '- one thing it does',
  '- another thing it does',
  '',
  'That is the whole of it 🎉 and nothing more.'
].join('\n')

const host = document.createElement('div')

function built(): HTMLDivElement {
  const container = document.createElement('div')
  container.innerHTML = DOMPurify.sanitize(marked.parse(PARA, { async: false, breaks: true }) as string)
  linkifyFiles(container)
  emojifyHtml(container)
  return container
}

const wasDrawn = (): void => {
  host.innerHTML = built().innerHTML
}

const isDrawn = (): void => {
  host.replaceChildren(...[...built().cloneNode(true).childNodes])
}

function best(label: string, work: () => void): number {
  let low = Infinity
  for (let round = 0; round < 5; round += 1) {
    for (let i = 0; i < 50; i += 1) work()
    const at = performance.now()
    for (let i = 0; i < 200; i += 1) work()
    low = Math.min(low, (performance.now() - at) / 200)
  }
  console.log(`${label.padEnd(24)} ${low.toFixed(4)} ms each`)
  return low
}

const PICTOGRAPHIC = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{20E3}]/u
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

const NODES = [...built().querySelectorAll('p, li')].map(el => el.textContent ?? '')

const walked = (): number => {
  let seen = 0
  for (const text of NODES) for (const { segment } of segmenter.segment(text)) if (segment) seen += 1
  return seen
}

const guarded = (): number => {
  let seen = 0
  for (const text of NODES) {
    if (!PICTOGRAPHIC.test(text)) {
      seen += 1
      continue
    }
    for (const { segment } of segmenter.segment(text)) if (segment) seen += 1
  }
  return seen
}

describe('the emoji walk, both ways, in one run', () => {
  it('times every grapheme against one test for a picture', () => {
    const a = best('walk every grapheme', walked)
    const b = best('test, then walk', guarded)
    console.log(`saved ${(a - b).toFixed(4)} ms a row, ${(((a - b) * 3832) / 1000).toFixed(2)} s over 3832`)
  })
})

describe('the markdown pipeline, both ways, in one run', () => {
  it('times the string round trip against the nodes it already built', () => {
    wasDrawn()
    isDrawn()
    const a = best('through a string', wasDrawn)
    const b = best('through the nodes', isDrawn)
    console.log(`saved ${(a - b).toFixed(4)} ms a row, ${(((a - b) * 3832) / 1000).toFixed(2)} s over 3832`)
  })
})
