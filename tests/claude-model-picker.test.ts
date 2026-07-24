// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CreateAgent from '../src/renderer/src/components/CreateAgent'
import type { AgentDef, ProviderCapability } from '../src/shared/llm'

Object.defineProperty(Element.prototype, 'getAnimations', {
  configurable: true,
  value: () => []
})

const capability: ProviderCapability = {
  provider: 'claude',
  label: 'Claude',
  fields: [
    {
      key: 'model',
      label: 'Model',
      options: [
        { value: 'opus', label: 'Opus' },
        { value: 'sonnet', label: 'Sonnet' }
      ],
      default: 'opus'
    },
    {
      key: 'opusModel',
      label: 'Version',
      options: [
        { value: 'claude-opus-5', label: 'Opus 5' },
        { value: 'claude-opus-4-8', label: 'Opus 4.8' }
      ],
      default: 'claude-opus-5',
      visibleWhen: { key: 'model', value: 'opus' }
    },
    {
      key: 'effort',
      label: 'Thinking',
      options: [{ value: 'high', label: 'High' }],
      default: 'high'
    }
  ],
  installed: true,
  installable: true
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('claude model picker', () => {
  it('opens an exact version picker for opus and creates the agent with that model', async () => {
    const createAgent = vi.fn(async (): Promise<AgentDef> => ({
      instanceId: 'claude-1',
      provider: 'claude',
      name: 'Claude Opus 4.8',
      settings: {}
    }))
    Object.defineProperty(window, 'crew', {
      configurable: true,
      value: {
        agentCapabilities: vi.fn(async () => [capability]),
        createAgent
      } as unknown as Window['crew']
    })

    render(createElement(CreateAgent))

    const add = screen.getByRole('button', { name: 'Add agent' }) as HTMLButtonElement
    await waitFor(() => expect(add.disabled).toBe(false))
    fireEvent.click(add)

    expect(screen.getByRole('button', { name: /VersionOpus 5/ })).toBeTruthy()
    expect((screen.getByPlaceholderText('Agent name') as HTMLInputElement).value).toBe('Claude Opus 5')

    fireEvent.click(screen.getByRole('button', { name: /VersionOpus 5/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Opus 4.8' }))

    expect((screen.getByPlaceholderText('Agent name') as HTMLInputElement).value).toBe('Claude Opus 4.8')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(createAgent).toHaveBeenCalledWith({
        provider: 'claude',
        name: 'Claude Opus 4.8',
        settings: {
          model: 'opus',
          opusModel: 'claude-opus-4-8',
          effort: 'high'
        }
      })
    )
  })

  it('hides the opus version picker for another Claude family', async () => {
    Object.defineProperty(window, 'crew', {
      configurable: true,
      value: {
        agentCapabilities: vi.fn(async () => [capability])
      } as unknown as Window['crew']
    })

    render(createElement(CreateAgent))

    const add = screen.getByRole('button', { name: 'Add agent' }) as HTMLButtonElement
    await waitFor(() => expect(add.disabled).toBe(false))
    fireEvent.click(add)
    fireEvent.click(screen.getByRole('button', { name: /ModelOpus/i }))
    fireEvent.click(screen.getByRole('button', { name: /sonnet/i }))

    expect(screen.queryByText('Version')).toBeNull()
    expect((screen.getByPlaceholderText('Agent name') as HTMLInputElement).value).toBe('Claude Sonnet')
  })
})
