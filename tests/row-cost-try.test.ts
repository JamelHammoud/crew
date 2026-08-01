// @vitest-environment jsdom
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { describe, it } from 'vitest'

const PARA = [
  'The parser reads the whole of the file before it says anything at all about what is in there,',
  'and `src/server/session.ts` is where it lands. See https://example.com/docs for the rest of it.',
  '',
  '- one thing it does',
  '- another thing it does',
  '',
  'That is the whole of it 🎉 and nothing more.'
].join('\n')

const clean = DOMPurify.sanitize(marked.parse(PARA, { async: false, breaks: true }) as string) as string

function time(label: string, runs: number, work: () => void): void {
  for (let i = 0; i < 20; i += 1) work()
  const at = performance.now()
  for (let i = 0; i < runs; i += 1) work()
  console.log(`${label.padEnd(34)} ${((performance.now() - at) / runs).toFixed(4)} ms each`)
}

const build = (): HTMLDivElement => {
  const div = document.createElement('div')
  div.innerHTML = clean
  return div
}

const walkWithClosest = (root: HTMLElement): number => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let seen = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (parent && !parent.closest('pre, code')) seen += 1
  }
  return seen
}

const SKIP = new Set(['PRE', 'CODE'])

const walkWithReject = (root: HTMLElement): number => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: node =>
      node.nodeType === Node.ELEMENT_NODE
        ? SKIP.has((node as Element).tagName)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP
        : NodeFilter.FILTER_ACCEPT
  })
  let seen = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) seen += 1
  return seen
}

describe('what the cheaper shapes cost', () => {
  it('times the string round trip against a clone', () => {
    const source = build()
    const host = document.createElement('div')
    time('serialize + parse', 300, () => {
      const html = source.innerHTML
      host.innerHTML = html
    })
    time('clone children', 300, () => {
      host.replaceChildren(...[...source.childNodes].map(node => node.cloneNode(true)))
    })
    time('sanitize to string', 300, () => {
      DOMPurify.sanitize(marked.parse(PARA, { async: false, breaks: true }) as string)
    })
    time('sanitize to dom', 300, () => {
      DOMPurify.sanitize(marked.parse(PARA, { async: false, breaks: true }) as string, { RETURN_DOM: true })
    })
  })

  it('times the two ways of walking text', () => {
    const root = build()
    console.log(`closest ${walkWithClosest(root)} nodes, reject ${walkWithReject(root)} nodes`)
    time('walk with closest', 500, () => walkWithClosest(root))
    time('walk rejecting subtrees', 500, () => walkWithReject(root))
  })
})
