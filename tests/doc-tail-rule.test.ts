// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(path.join(root, 'src/renderer/src/styles.css'), 'utf8')

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia

const { default: DocEditor } = await import('../src/renderer/src/components/DocEditor')

const rule = (selector: string): string => {
  const at = styles.indexOf(selector)
  expect(at).toBeGreaterThan(-1)
  return styles.slice(at, styles.indexOf('\n}', at))
}

// The room under the last block is one number. It was the editor's own padding
// and the trailing block was 30 pixels of it, so everything below those 30 fell
// to the nearest text position, which for a doc ending in a code block is inside
// the code: clicking the empty page under it took the caret into the snippet and
// there was no way to write after it at all. The two carry the same room now,
// and never both, or a doc ends on twice the gap it asked for.
describe('the room under the last block', () => {
  it('is one number, written down once', () => {
    expect(rule(':root {')).toContain('--doc-tail: 30vh')
    expect(styles).not.toContain('padding-bottom: 30vh')
  })

  it('is the trailing block where there is one', () => {
    expect(rule('.doc .bn-editor .bn-trailing-block')).toContain('height: var(--doc-tail)')
  })

  it('is the editor’s own only where there is not', () => {
    expect(rule('.doc .bn-editor:not(:has(.bn-trailing-block))')).toContain('padding-bottom: var(--doc-tail)')
  })
})

describe('clicking the page under a code block', () => {
  it('lands on the trailing block rather than in the code', () => {
    const { container } = render(
      createElement(DocEditor, { text: 'Words\n\n```ts\nconst one = 1\n```\n', onChange: () => {} })
    )
    const editor = container.querySelector('.bn-editor') as HTMLElement
    const tail = editor.querySelector('.bn-trailing-block') as HTMLElement
    expect(tail).toBeTruthy()
    expect(tail.parentElement?.lastElementChild).toBe(tail)

    tail.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    const last = container.querySelectorAll('.bn-block-content')
    expect(last[last.length - 1]?.getAttribute('data-content-type')).toBe('paragraph')
  })

  it('has nothing to stand in the way of a doc that already ends in an empty line', () => {
    const { container } = render(createElement(DocEditor, { text: 'Words\n\n\n', onChange: () => {} }))
    expect(container.querySelector('.bn-trailing-block')).toBeNull()
  })
})
