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

describe('doc editor probe', () => {
  it('mounts without crashing', () => {
    const { container } = render(createElement(DocEditor, { text: '# Hello\n\nWorld', onChange: () => {} }))
    expect(container.querySelector('.bn-container')).toBeTruthy()
    expect(container.textContent).toContain('Hello')
  })
})
