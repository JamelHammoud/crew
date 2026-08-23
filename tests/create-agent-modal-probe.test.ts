// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CreateAgent from '../src/renderer/src/components/CreateAgent'
import { grokFields } from '../src/runner/providers/grok'
import type { ProviderCapability } from '../src/shared/llm'

Object.defineProperty(Element.prototype, 'getAnimations', {
  configurable: true,
  value: () => []
})

const capabilities: ProviderCapability[] = [
  {
    provider: 'claude',
    label: 'Claude',
    fields: [{ key: 'model', label: 'Model', options: [{ value: '', label: 'Default' }], default: '' }],
    installed: true,
    installable: true
  },
  {
    provider: 'grok',
    label: 'Grok',
    fields: grokFields(),
    installed: true,
    installable: true
  }
]

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('the advanced screen while creating an agent', () => {
  it('keeps the Grok settings inside a window-height scroller', async () => {
    Object.defineProperty(window, 'crew', {
      configurable: true,
      value: {
        agentCapabilities: vi.fn(async () => capabilities),
        modelServers: vi.fn(async () => [])
      } as unknown as Window['crew']
    })

    render(createElement(CreateAgent))

    const add = screen.getByRole('button', { name: 'Add an agent' }) as HTMLButtonElement
    await waitFor(() => expect(add.disabled).toBe(false))
    fireEvent.click(add)
    fireEvent.click(screen.getByRole('button', { name: 'Provider' }))
    fireEvent.click(screen.getByRole('button', { name: 'Grok' }))
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))

    const dialog = screen.getByRole('dialog', { name: 'Advanced' })
    const page = dialog.querySelector(':scope > .overflow-y-auto') as HTMLElement

    expect(page).not.toBeNull()
    expect(page.parentElement).toBe(dialog)
    expect(page.className).toContain('max-h-[calc(100dvh-3rem)]')
    expect(page.className).toContain('overscroll-contain')
    expect(screen.getByText('Grok memory')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
  })
})
