// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

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

const kinds = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('.bn-block-content')).map(
    block => block.getAttribute('data-content-type') ?? ''
  )

describe('clicking the page under a code block', () => {
  it('lands on the trailing block, which stands at the foot of the writing', () => {
    const { container } = render(
      createElement(DocEditor, { text: 'Words\n\n```ts\nconst one = 1\n```\n', onChange: () => {} })
    )
    const editor = container.querySelector('.bn-editor') as HTMLElement
    const tail = editor.querySelector('.bn-trailing-block') as HTMLElement
    expect(tail).toBeTruthy()
    expect(tail.parentElement?.lastElementChild).toBe(tail)
    expect(kinds(container)).toEqual(['paragraph', 'codeBlock'])
  })

  it('writes a line after the code rather than taking the caret into it', () => {
    const { container } = render(createElement(DocEditor, { text: '```ts\nconst one = 1\n```\n', onChange: () => {} }))
    const tail = container.querySelector('.bn-trailing-block') as HTMLElement
    tail.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(kinds(container)).toEqual(['codeBlock', 'paragraph'])
  })

  // Both carrying the room is a doc ending on twice the gap it asked for, so the
  // trailing block goes the moment the writing ends on a line to write in.
  it('stands down once there is a line at the foot of the doc', () => {
    const { container } = render(createElement(DocEditor, { text: '```ts\nconst one = 1\n```\n', onChange: () => {} }))
    const tail = container.querySelector('.bn-trailing-block') as HTMLElement
    tail.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(container.querySelector('.bn-trailing-block')).toBeNull()
  })
})
