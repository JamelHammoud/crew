// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CreateAgent from '../src/renderer/src/components/CreateAgent'
import type { AgentDef, ProviderCapability } from '../src/shared/llm'
import { serverProviderName, type ModelServer } from '../src/shared/modelServers'

Object.defineProperty(Element.prototype, 'getAnimations', {
  configurable: true,
  value: () => []
})

const RACK = 'http://192.0.2.10:39862/v1'

const ollama: ProviderCapability = {
  provider: 'local',
  label: 'Ollama',
  fields: [
    {
      key: 'address',
      label: 'Server',
      options: [{ value: 'http://127.0.0.1:11434', label: 'Ollama' }],
      default: 'http://127.0.0.1:11434',
      free: true
    },
    { key: 'model', label: 'Model', options: [{ value: 'here:8b', label: 'here:8b' }], default: 'here:8b' }
  ],
  installed: true,
  installable: true
}

const rack: ProviderCapability = {
  provider: serverProviderName(RACK),
  label: 'The rack',
  server: RACK,
  fields: [{ key: 'model', label: 'Model', options: [{ value: 'far:70b', label: 'far:70b' }], default: 'far:70b' }],
  installed: true,
  installable: false
}

const down: ProviderCapability = { ...rack, installed: false, hint: 'Not answering' }

function stand(caps: ProviderCapability[], servers: ModelServer[] = []) {
  const addModelServer = vi.fn(async (): Promise<ProviderCapability[]> => [ollama, rack])
  const createAgent = vi.fn(
    async (): Promise<AgentDef> => ({ instanceId: 'one', provider: rack.provider, name: 'The rack', settings: {} })
  )
  Object.defineProperty(window, 'crew', {
    configurable: true,
    value: {
      agentCapabilities: vi.fn(async () => caps),
      modelServers: vi.fn(async () => servers),
      addModelServer,
      forgetModelServer: vi.fn(async () => [ollama]),
      createAgent
    } as unknown as Window['crew']
  })
  return { addModelServer, createAgent }
}

async function openCard() {
  render(createElement(CreateAgent))
  const add = screen.getByRole('button', { name: 'Add an agent' }) as HTMLButtonElement
  await waitFor(() => expect(add.disabled).toBe(false))
  fireEvent.click(add)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('a server in the list of providers', () => {
  it('stands under its own name beside the ones that ship', async () => {
    stand([ollama, rack])
    await openCard()
    fireEvent.click(screen.getByRole('button', { name: /ProviderOllama/ }))
    expect(screen.getByRole('button', { name: 'The rack' })).toBeTruthy()
  })

  // Its models are its own, so picking it leaves Ollama's behind entirely.
  it('offers what it serves and nothing this computer is running', async () => {
    stand([ollama, rack])
    await openCard()
    fireEvent.click(screen.getByRole('button', { name: /ProviderOllama/ }))
    fireEvent.click(screen.getByRole('button', { name: 'The rack' }))
    expect(screen.getByRole('button', { name: /Modelfar:70b/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Modelhere:8b/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Server/ })).toBeNull()
  })

  it('makes an agent that is written down against the address rather than the name', async () => {
    const { createAgent } = stand([ollama, rack])
    await openCard()
    fireEvent.click(screen.getByRole('button', { name: /ProviderOllama/ }))
    fireEvent.click(screen.getByRole('button', { name: 'The rack' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(createAgent).toHaveBeenCalledWith({
        provider: serverProviderName(RACK),
        name: 'The rack Far:70b',
        settings: { model: 'far:70b' }
      })
    )
  })

  // Nothing here is installed or not, so the word on the row is what it is
  // really doing.
  it('says it is not answering rather than that it is not installed', async () => {
    stand([ollama, down])
    await openCard()
    fireEvent.click(screen.getByRole('button', { name: /ProviderOllama/ }))
    expect(screen.getByText('Not answering')).toBeTruthy()
  })
})

describe('adding one', () => {
  it('is the way the list of providers ends', async () => {
    stand([ollama])
    await openCard()
    fireEvent.click(screen.getByRole('button', { name: /ProviderOllama/ }))
    expect(screen.getByRole('button', { name: 'Add a provider' })).toBeTruthy()
  })

  it('takes a name and lands on the row it just made', async () => {
    const { addModelServer } = stand([ollama])
    await openCard()
    fireEvent.click(screen.getByRole('button', { name: /ProviderOllama/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add a provider' }))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'The rack' } })
    fireEvent.change(screen.getByPlaceholderText('Address'), { target: { value: '192.0.2.10:39862/v1' } })
    fireEvent.change(screen.getByPlaceholderText('Key'), { target: { value: 'sk-one' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(addModelServer).toHaveBeenCalledWith({ url: RACK, name: 'The rack', key: 'sk-one' })
    )
    await waitFor(() => expect(screen.getByRole('button', { name: /ProviderThe rack/ })).toBeTruthy())
  })

  it('says why it did not happen on the card the address was typed on', async () => {
    stand([ollama])
    Object.defineProperty(window.crew, 'addModelServer', {
      configurable: true,
      value: vi.fn(async () => {
        throw new Error('That server wants a key.')
      })
    })
    await openCard()
    fireEvent.click(screen.getByRole('button', { name: /ProviderOllama/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add a provider' }))
    fireEvent.change(screen.getByPlaceholderText('Address'), { target: { value: '192.0.2.10:39862/v1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByText(/That server wants a key\./)).toBeTruthy())
    expect(screen.getByPlaceholderText('Address')).toBeTruthy()
  })

  it('lists what is written down under the names they were given', async () => {
    stand([ollama, rack], [{ url: RACK, name: 'The rack' }, { url: 'http://192.0.2.11:8000' }])
    await openCard()
    fireEvent.click(screen.getByRole('button', { name: /ProviderOllama/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add a provider' }))
    await waitFor(() => expect(screen.getByText('The rack')).toBeTruthy())
    expect(screen.getByText('192.0.2.11:8000')).toBeTruthy()
  })
})
