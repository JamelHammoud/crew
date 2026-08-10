// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Scribe from '../src/renderer/src/components/settings/Scribe'
import { setScribeSettings } from '../src/renderer/src/state/scribeSettings'

const AT = 'http://127.0.0.1:11434'

let models: string[] = []
let asked: string[] = []

beforeEach(() => {
  models = ['qwen3:4b', 'llama3.2']
  asked = []
  vi.stubGlobal('crew', {
    applyScribe: vi.fn(),
    scribeState: vi.fn().mockResolvedValue({ hooked: true, trusted: true }),
    openScribePermission: vi.fn(),
    scribeSaid: vi.fn().mockResolvedValue([]),
    onScribeSaid: vi.fn().mockReturnValue(() => {})
  })
  vi.stubGlobal('fetch', (url: string) => {
    asked.push(String(url))
    return Promise.resolve(
      new Response(JSON.stringify({ data: models.map(id => ({ id })) }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )
  })
})

afterEach(() => {
  cleanup()
  act(() => setScribeSettings({ edit: false, editModel: '', editUrl: AT }))
  vi.unstubAllGlobals()
})

const open = async (): Promise<void> => {
  await act(async () => {
    render(createElement(Scribe))
  })
}

describe('the page a dictation is set to be written up on', () => {
  it('says nothing about a server until it is turned on', async () => {
    await open()
    expect(screen.getByText('Use a model on this computer')).toBeTruthy()
    expect(screen.queryByText('Server')).toBe(null)
    expect(screen.queryByText('Model')).toBe(null)
    expect(asked).toHaveLength(0)
  })

  it('asks what the server will serve once it is on', async () => {
    act(() => setScribeSettings({ edit: true }))
    await open()
    expect(screen.getByText('Server')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Model')).toBeTruthy())
    expect(asked).toEqual([`${AT}/v1/models`])
  })

  it('says which model was picked', async () => {
    act(() => setScribeSettings({ edit: true, editModel: 'llama3.2' }))
    await open()
    await waitFor(() => expect(screen.getByText('llama3.2')).toBeTruthy())
  })

  it('says so where nothing answers, rather than opening an empty picker', async () => {
    models = []
    act(() => setScribeSettings({ edit: true }))
    await open()
    await waitFor(() => expect(screen.getByText('Nothing answered there')).toBeTruthy())
    expect(screen.getByText('Start it and the models turn up here.')).toBeTruthy()
    expect(screen.queryByText('Model')).toBe(null)
  })

  it('writes the address down once it is settled rather than on every keystroke', async () => {
    act(() => setScribeSettings({ edit: true }))
    await open()
    const field = () => screen.getByPlaceholderText('Address') as HTMLInputElement
    await act(async () => {
      fireEvent.change(field(), { target: { value: '127.0.0.1:1234' } })
    })
    expect(field().value).toBe('127.0.0.1:1234')
    expect(asked).toHaveLength(1)
    await act(async () => {
      fireEvent.blur(field())
    })
    await waitFor(() => expect(field().value).toBe('http://127.0.0.1:1234'))
    expect(asked).toEqual([`${AT}/v1/models`, 'http://127.0.0.1:1234/v1/models'])
  })
})
