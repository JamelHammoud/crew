// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import DocEditor from '../src/renderer/src/components/DocEditor'

describe('doc editor probe', () => {
  it('mounts without crashing', () => {
    const { container } = render(createElement(DocEditor, { text: '# Hello\n\nWorld', onChange: () => {} }))
    expect(container.querySelector('.bn-container')).toBeTruthy()
  })
})
