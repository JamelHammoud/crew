// @vitest-environment jsdom
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { describe, it } from 'vitest'
import { emojifyHtml } from '../src/renderer/src/components/emojiHtml'
import { tokenizeEmoji } from '../src/renderer/src/components/emojiTokens'
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

const PLAIN = 'The parser reads the whole of the file before it says anything at all about what is in there.'

function time(label: string, runs: number, work: () => void): void {
  for (let i = 0; i < 20; i += 1) work()
  const at = performance.now()
  for (let i = 0; i < runs; i += 1) work()
  console.log(`${label.padEnd(30)} ${((performance.now() - at) / runs).toFixed(4)} ms each`)
}

describe('where the markdown pipeline spends it', () => {
  it('times each step', () => {
    let html = ''
    time('marked.parse', 200, () => {
      html = marked.parse(PARA, { async: false, breaks: true }) as string
    })
    let clean = ''
    time('DOMPurify.sanitize', 200, () => {
      clean = DOMPurify.sanitize(html) as unknown as string
    })
    time('build container + innerHTML', 200, () => {
      const container = document.createElement('div')
      container.innerHTML = clean
    })
    time('linkifyFiles', 200, () => {
      const container = document.createElement('div')
      container.innerHTML = clean
      linkifyFiles(container)
    })
    time('emojifyHtml', 200, () => {
      const container = document.createElement('div')
      container.innerHTML = clean
      emojifyHtml(container)
    })
    time('read back innerHTML', 200, () => {
      const container = document.createElement('div')
      container.innerHTML = clean
      void container.innerHTML
    })
  })

  it('times the emoji walk on plain prose', () => {
    time('tokenizeEmoji, no emoji', 500, () => {
      tokenizeEmoji(PLAIN)
    })
    time('tokenizeEmoji, one emoji', 500, () => {
      tokenizeEmoji(`${PLAIN} 🎉`)
    })
    const long = Array.from({ length: 20 }, () => PLAIN).join(' ')
    time('tokenizeEmoji, long prose', 200, () => {
      tokenizeEmoji(long)
    })
  })
})
