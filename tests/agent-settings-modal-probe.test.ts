// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentSettingField } from '../src/shared/llm'
import AgentSettingsModal from '../src/renderer/src/components/agent/AgentSettingsModal'

afterEach(cleanup)

const fields: AgentSettingField[] = [
  { key: 'search', label: 'Web access', kind: 'switch', default: '', advanced: true, section: 'Tools' },
  { key: 'planning', label: 'Planning', kind: 'switch', default: '', advanced: true, section: 'Tools' },
  { key: 'turns', label: 'Most turns per message', kind: 'number', default: '', advanced: true, section: 'Limits' }
]

describe('the advanced agent settings modal', () => {
  it('keeps its page inside the window and scrolls it within the clipped card', () => {
    const { baseElement } = render(
      createElement(AgentSettingsModal, {
        open: true,
        label: 'Grok',
        fields,
        settings: {},
        onChange: () => {},
        onClose: () => {}
      })
    )

    const dialog = screen.getByRole('dialog')
    const page = baseElement.querySelector('.overflow-y-auto') as HTMLElement

    expect(dialog.className).toContain('overflow-hidden')
    expect(page.parentElement).toBe(dialog)
    expect(page.className).toContain('max-h-[calc(100vh-3rem)]')
    expect(page.className).toContain('overscroll-contain')
    expect(screen.getByRole('button', { name: 'Done' })).not.toBeNull()
  })
})
