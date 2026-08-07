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

describe('scratch', () => {
  it('dumps', () => {
    const { container } = render(
      createElement(DocEditor, { text: 'Words\n\n```ts\nconst one = 1\n```\n', onChange: () => {} })
    )
    console.log(container.querySelector('.bn-editor')?.outerHTML.slice(0, 4000))
    console.log('TRAILING', !!container.querySelector('.bn-trailing-block'))
    expect(true).toBe(true)
  })
})
