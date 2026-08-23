// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AgentCard from '../src/renderer/src/components/AgentCard'
import CreateAgent from '../src/renderer/src/components/CreateAgent'
import AgentSettingsModal from '../src/renderer/src/components/agent/AgentSettingsModal'
import { grokFields } from '../src/runner/providers/grok'
import type { AgentSettingField, PooledAgent, ProviderCapability } from '../src/shared/llm'

Object.defineProperty(Element.prototype, 'getAnimations', {
  configurable: true,
  value: () => []
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const fields: AgentSettingField[] = [
  { key: 'model', label: 'Model', options: [{ value: '', label: 'Default' }], default: '' },
  { key: 'search', label: 'Web access', kind: 'switch', default: '', advanced: true, section: 'Tools' },
  { key: 'planning', label: 'Planning', kind: 'switch', default: '', advanced: true, section: 'Tools' },
  { key: 'turns', label: 'Most turns per message', kind: 'number', default: '', advanced: true, section: 'Limits' }
]

const agent: PooledAgent = {
  id: 'ali/grok',
  label: 'Grok',
  provider: 'grok',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields
}

describe('the agent settings card', () => {
  it('holds every control, so the row in the list holds none', () => {
    const { container } = render(
      createElement(AgentCard, { agent, threadCount: 0, onSetting: () => {}, onRename: () => {} })
    )
    const row = container.firstElementChild as HTMLElement

    expect(within(row).queryByRole('button', { name: 'Model' })).toBeNull()
    expect(within(row).queryByRole('button', { name: 'Advanced' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(within(row).getByRole('button', { name: 'Agent settings' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Model' })).toBeTruthy()
    expect((within(dialog).getByLabelText('Agent name') as HTMLInputElement).value).toBe('Grok')
    expect(within(dialog).getByRole('button', { name: 'Advanced' })).toBeTruthy()
  })

  it('says what it runs on with the provider mark rather than in words', () => {
    const { container } = render(
      createElement(AgentCard, { agent, threadCount: 0, onSetting: () => {}, onRename: () => {} })
    )
    const row = container.firstElementChild as HTMLElement

    expect(row.querySelector('img')).toBeTruthy()
    expect(row.textContent).not.toContain(agent.provider)
  })

  it('writes the name down once it is settled, never on each keystroke', () => {
    const renamed: string[] = []
    render(
      createElement(AgentCard, {
        agent,
        threadCount: 0,
        onSetting: () => {},
        onRename: (label: string) => renamed.push(label)
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Agent settings' }))

    const name = screen.getByLabelText('Agent name')
    fireEvent.change(name, { target: { value: 'Bubbles' } })
    expect(renamed).toEqual([])
    fireEvent.blur(name)
    expect(renamed).toEqual(['Bubbles'])
  })

  it('keeps its header and footer outside the fading scroll body', () => {
    const { baseElement } = render(
      createElement(AgentSettingsModal, {
        open: true,
        agent,
        onChange: () => {},
        onClose: () => {}
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))

    const dialog = screen.getByRole('dialog')
    const page = baseElement.querySelector('[data-modal-body]') as HTMLElement
    const done = screen.getByRole('button', { name: 'Done' })
    const heading = screen.getByRole('heading', { name: 'Grok' })

    expect(dialog.className).toContain('max-h-full')
    expect(dialog.className).toContain('flex-col')
    expect(dialog.className).toContain('overflow-hidden')
    expect(page.parentElement).toBe(dialog)
    expect(page.className).toContain('min-h-0')
    expect(page.className).toContain('flex-1')
    expect(page.className).toContain('overscroll-contain')
    expect(page.className).toContain('scroll-fade')
    expect(page.contains(heading)).toBe(false)
    expect(page.contains(done)).toBe(false)
  })
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

describe('the advanced screen while creating an agent', () => {
  it('keeps the Grok settings inside a window-height scroller', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300)
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(600)
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
    const page = dialog.querySelector(':scope > [data-modal-body]') as HTMLElement
    const back = screen.getByRole('button', { name: 'Back' })
    const done = screen.getByRole('button', { name: 'Done' })

    expect(page).not.toBeNull()
    expect(page.parentElement).toBe(dialog)
    expect(dialog.className).toContain('max-h-full')
    expect(page.className).toContain('overscroll-contain')
    expect(page.className).toContain('scroll-fade')
    expect(page.contains(back)).toBe(false)
    expect(page.contains(done)).toBe(false)
    await waitFor(() => expect(page.hasAttribute('data-fade-bottom')).toBe(true))
    page.scrollTop = 300
    fireEvent.scroll(page)
    await waitFor(() => expect(page.hasAttribute('data-fade-top')).toBe(true))
    expect(page.hasAttribute('data-fade-bottom')).toBe(false)
    expect(screen.getByText('Grok memory')).toBeTruthy()
  })
})
